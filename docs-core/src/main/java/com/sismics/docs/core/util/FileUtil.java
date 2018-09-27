package com.sismics.docs.core.util;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.collect.Lists;
import com.google.common.io.CharStreams;
import com.sismics.docs.core.constant.Constants;
import com.sismics.docs.core.dao.jpa.FileDao;
import com.sismics.docs.core.dao.jpa.UserDao;
import com.sismics.docs.core.event.DocumentUpdatedAsyncEvent;
import com.sismics.docs.core.event.FileCreatedAsyncEvent;
import com.sismics.docs.core.model.jpa.File;
import com.sismics.docs.core.model.jpa.User;
import com.sismics.util.ImageDeskew;
import com.sismics.util.Scalr;
import com.sismics.util.context.ThreadLocalContext;
import com.sismics.util.io.InputStreamReaderThread;
import com.sismics.util.mime.MimeTypeUtil;
import org.apache.commons.lang.StringUtils;

import javax.crypto.Cipher;
import javax.crypto.CipherInputStream;
import javax.imageio.ImageIO;
import javax.json.Json;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObjectBuilder;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * File entity utilities.
 * 
 * @author bgamard
 */
public class FileUtil {
    /**
     * File ID of files currently being processed.
     */
    private static Set<String> processingFileSet = Collections.synchronizedSet(new HashSet<String>());
    
    /**
     * Optical character recognition on an image.
     *
     * @param language Language to OCR
     * @param image Buffered image
     * @return Content extracted
     * @throws Exception e
     */
    public static String ocrFile(String language, BufferedImage image) throws Exception {
        // Upscale, grayscale and deskew the image
        BufferedImage resizedImage = Scalr.resize(image, Scalr.Method.AUTOMATIC, Scalr.Mode.AUTOMATIC, 3500, Scalr.OP_ANTIALIAS, Scalr.OP_GRAYSCALE);
        image.flush();
        ImageDeskew imageDeskew = new ImageDeskew(resizedImage);
        BufferedImage deskewedImage = Scalr.rotate(resizedImage, - imageDeskew.getSkewAngle(), Scalr.OP_ANTIALIAS, Scalr.OP_GRAYSCALE);
        resizedImage.flush();
        Path tmpFile = ThreadLocalContext.get().createTemporaryFile();
        ImageIO.write(deskewedImage, "tiff", tmpFile.toFile());

        List<String> result = Lists.newLinkedList(Arrays.asList("tesseract", tmpFile.toAbsolutePath().toString(), "stdout", "-l", language));
        ProcessBuilder pb = new ProcessBuilder(result);
        Process process = pb.start();

        // Consume the process error stream
        final String commandName = pb.command().get(0);
        new InputStreamReaderThread(process.getErrorStream(), commandName).start();

        // Consume the data as text
        try (InputStream is = process.getInputStream()) {
            return CharStreams.toString(new InputStreamReader(is, Charsets.UTF_8));
        }
    }

    /**
     * Remove a file from the storage filesystem.
     * 
     * @param file File to delete
     */
    public static void delete(File file) throws IOException {
        Path storedFile = DirectoryUtil.getStorageDirectory().resolve(file.getId());
        Path webFile = DirectoryUtil.getStorageDirectory().resolve(file.getId() + "_web");
        Path thumbnailFile = DirectoryUtil.getStorageDirectory().resolve(file.getId() + "_thumb");
        
        if (Files.exists(storedFile)) {
            Files.delete(storedFile);
        }
        if (Files.exists(webFile)) {
            Files.delete(webFile);
        }
        if (Files.exists(thumbnailFile)) {
            Files.delete(thumbnailFile);
        }
    }

    /**
     * Create a new file.
     *
     * @param name File name, can be null
     * @param unencryptedFile Path to the unencrypted file
     * @param fileSize File size
     * @param language File language, can be null if associated to no document
     * @param userId User ID creating the file
     * @param documentId Associated document ID or null if no document
     * @return File ID
     * @throws Exception e
     */
    public static String createFile(String name, Path unencryptedFile, long fileSize, String language, String userId, String documentId) throws Exception {
        // Validate mime type
        String mimeType;
        try {
            mimeType = MimeTypeUtil.guessMimeType(unencryptedFile, name);
        } catch (IOException e) {
            throw new IOException("ErrorGuessMime", e);
        }

        // Validate user quota
        UserDao userDao = new UserDao();
        User user = userDao.getById(userId);
        if (user.getStorageCurrent() + fileSize > user.getStorageQuota()) {
            throw new IOException("QuotaReached");
        }

        // Validate global quota
        String globalStorageQuotaStr = System.getenv(Constants.GLOBAL_QUOTA_ENV);
        if (!Strings.isNullOrEmpty(globalStorageQuotaStr)) {
            long globalStorageQuota = Long.valueOf(globalStorageQuotaStr);
            long globalStorageCurrent = userDao.getGlobalStorageCurrent();
            if (globalStorageCurrent + fileSize > globalStorageQuota) {
                throw new IOException("QuotaReached");
            }
        }

        // Get files of this document
        FileDao fileDao = new FileDao();
        int order = 0;
        if (documentId != null) {
            for (File file : fileDao.getByDocumentId(userId, documentId)) {
                file.setOrder(order++);
            }
        }

        // Create the file
        File file = new File();
        file.setOrder(order);
        file.setDocumentId(documentId);
        file.setName(StringUtils.abbreviate(name, 200));
        file.setMimeType(mimeType);
        file.setUserId(userId);
        String fileId = fileDao.create(file, userId);

        // Save the file
        Cipher cipher = EncryptionUtil.getEncryptionCipher(user.getPrivateKey());
        Path path = DirectoryUtil.getStorageDirectory().resolve(file.getId());
        try (InputStream inputStream = Files.newInputStream(unencryptedFile)) {
            Files.copy(new CipherInputStream(inputStream, cipher), path);
        }

        // Update the user quota
        user.setStorageCurrent(user.getStorageCurrent() + fileSize);
        userDao.updateQuota(user);

        // Raise a new file created event and document updated event if we have a document
        startProcessingFile(fileId);
        FileCreatedAsyncEvent fileCreatedAsyncEvent = new FileCreatedAsyncEvent();
        fileCreatedAsyncEvent.setUserId(userId);
        fileCreatedAsyncEvent.setLanguage(language);
        fileCreatedAsyncEvent.setFile(file);
        fileCreatedAsyncEvent.setUnencryptedFile(unencryptedFile);
        ThreadLocalContext.get().addAsyncEvent(fileCreatedAsyncEvent);

        if (documentId != null) {
            DocumentUpdatedAsyncEvent documentUpdatedAsyncEvent = new DocumentUpdatedAsyncEvent();
            documentUpdatedAsyncEvent.setUserId(userId);
            documentUpdatedAsyncEvent.setDocumentId(documentId);
            ThreadLocalContext.get().addAsyncEvent(documentUpdatedAsyncEvent);
        }

        return fileId;
    }

    /**
     * Create multiple child file from input stream of a zip file.
     * @param fileInputStream
     * @param language
     * @param userId
     * @param documentId
     * @return
     * @throws Exception
     */
    public static List<Map<String, String>> createMultipleFilesWithZip(InputStream fileInputStream, String language, String userId, String documentId) throws Exception {
        List<Map<String, String>> createdFiles = new ArrayList<>();
        ZipInputStream zipInputStream = new ZipInputStream(fileInputStream);
        String parentPath = null;
        ZipOutputStream zipOutputStream = null;
        java.io.File outputFile = null;
        Path outputPath = null;
        int length;
        byte[] bytes = new byte[1024];

        //Build new zip file list from old
        ZipEntry zipEntry = zipInputStream.getNextEntry();
        while (zipEntry != null) {
            Path entryPath = Paths.get(zipEntry.getName());
            if (!zipEntry.isDirectory()) {
                if(parentPath == null) {
                    parentPath = entryPath.getParent().toString();
                    outputPath = ThreadLocalContext.get().createTemporaryFile();
                    outputFile = new java.io.File(outputPath.toString());
                    zipOutputStream = new ZipOutputStream(new FileOutputStream(outputFile));
                }
                ZipEntry newZEntry = new ZipEntry(entryPath.getFileName().toString());
                zipOutputStream.putNextEntry(newZEntry);
                while((length = zipInputStream.read(bytes)) >= 0) {
                    zipOutputStream.write(bytes, 0, length);
                }
                zipOutputStream.closeEntry();
            }

            zipEntry = zipInputStream.getNextEntry();
            if(zipEntry == null || zipEntry.isDirectory()){
                if(zipOutputStream != null && outputPath != null) {
                    zipOutputStream.finish();
                    zipOutputStream.close();
                    String outputName = parentPath.replaceAll("/", "_") + ".zip";
                    long fileSize = Files.size(outputPath);
                    String newId = FileUtil.createFile(outputName, outputPath, fileSize, language, userId, documentId);
                    Map<String, String> fileInfo = new HashMap<>();
                            fileInfo.put("id", newId);
                            fileInfo.put("name", outputName);
                            fileInfo.put("size", String.valueOf(fileSize));
                    createdFiles.add(fileInfo);
                    outputPath = null;
                    zipOutputStream = null;
                }
                parentPath = null;
            }
        }

        return createdFiles;
    }

    /**
     * Start processing a file.
     *
     * @param fileId File ID
     */
    public static void startProcessingFile(String fileId) {
        processingFileSet.add(fileId);
    }

    /**
     * End processing a file.
     *
     * @param fileId File ID
     */
    public static void endProcessingFile(String fileId) {
        processingFileSet.remove(fileId);
    }

    /**
     * Return true if a file is currently processing.
     *
     * @param fileId File ID
     * @return True if the file is processing
     */
    public static boolean isProcessingFile(String fileId) {
        return processingFileSet.contains(fileId);
    }
}
