'use strict';

/**
 * Document view content controller.
 */
angular.module('docs').controller('DocumentViewContent', function ($scope, $rootScope, $stateParams, Restangular, $dialog, $state, Upload, $translate, $uibModal) {
  /**
   * File type config
   */
  $scope.fileListStyle = $rootScope.docFileListStyle;

  /**
   * Configuration for file sorting.
   */
  $scope.fileSortableOptions = {
    forceHelperSize: true,
    forcePlaceholderSize: true,
    tolerance: 'pointer',
    handle: '.handle',
    stop: function () {
      // Send new positions to server
      $scope.$apply(function () {
        Restangular.one('file').post('reorder', {
          id: $stateParams.id,
          order: _.pluck($scope.files, 'id')
        });
      });
    }
  };

  /**
   * Load files from server.
   */
  $scope.loadFiles = function () {
    Restangular.one('file/list').get({ id: $stateParams.id }).then(function (data) {
      data.files.forEach(function(file) {
        file.fileViewer = selectFileViewer(file);
      });
      $scope.files = data.files;
      // TODO Keep currently uploading files
    });
  };
  $scope.loadFiles();

  function selectFileViewer(file){
    var dicomNameRegex = $rootScope.app.dicom_name_regex;
    if(true) {
      return 'DicomViewer';
    }  else {
      return 'ImageViewer';
    }
  }

  /**
   * Navigate to the selected file.
   */
  $scope.openFile = function (file) {
      $state.go('document.view.content.file', { id: $stateParams.id, fileId: file.id })
  };

  /**
   * Delete a file.
   */
  $scope.deleteFile = function (file) {
    var title = $translate.instant('document.view.content.delete_file_title');
    var msg = $translate.instant('document.view.content.delete_file_message');
    var btns = [
      {result: 'cancel', label: $translate.instant('cancel')},
      {result: 'ok', label: $translate.instant('ok'), cssClass: 'btn-primary'}
    ];

    $dialog.messageBox(title, msg, btns, function (result) {
      if (result === 'ok') {
        Restangular.one('file', file.id).remove().then(function () {
          // File deleted, decrease used quota
          $rootScope.userInfo.storage_current -= file.size;

          // Update local data
          $scope.loadFiles();
        });
      }
    });
  };

  /**
   * File has been drag & dropped.
   */
  $scope.fileDropped = function(files) {
    if (!$scope.document.writable) {
      return;
    }

    if (files && files.length) {
      // Adding files to the UI
      var newfiles = [];
      _.each(files, function(file) {
        var newfile = {
          progress: 0,
          name: file.name,
          create_date: new Date().getTime(),
          mimetype: file.type,
          status: $translate.instant('document.view.content.upload_pending')
        };
        $scope.files.push(newfile);
        newfiles.push(newfile);
      });

      // Uploading files sequentially
      var key = 0;
      var then = function() {
        if (files[key]) {
          $scope.uploadFile(files[key], newfiles[key++]).then(then);
        }
      };
      then();
    }
  };

  /**
   * Upload a file.
   */
  $scope.uploadFile = function(file, newfile) {
    // Upload the file
    newfile.status = $translate.instant('document.view.content.upload_progress');
    return Upload.upload({
      method: 'PUT',
      url: '../api/file',
      file: file,
      fields: {
        id: $stateParams.id
      }
    })
    .progress(function(e) {
      newfile.progress = parseInt(100.0 * e.loaded / e.total);
    })
    .success(function(data) {
      if(!!data.zipList && data.zipList.length > 0) {
        var fileList = $scope.files;
        data.zipList.forEach(function(file) {
          var newZFile = angular.copy(newfile);
          newZFile.name = file.name;
          newZFile.size = file.size;
          $rootScope.userInfo.storage_current += file.size;
          newZFile.id = file.id;
          fileList.push(newZFile);
        });

        //Replace new file with zip list
        for(var i = 0; i < fileList.length; i++) {
          if(fileList[i].name == data.name) {
            delete fileList.splice(i, 1);
          }
        }
      } else {
        // Update local model with real data
        newfile.id = data.id;
        newfile.size = data.size;

        // New file uploaded, increase used quota
        $rootScope.userInfo.storage_current += data.size;
      }
    })
    .error(function (data) {
      newfile.status = $translate.instant('document.view.content.upload_error');
      if (data.type === 'QuotaReached') {
        newfile.status += ' - ' + $translate.instant('document.view.content.upload_error_quota');
      }
    });
  };

  /**
   * Rename a file.
   */
  $scope.renameFile = function (file) {
    $uibModal.open({
      templateUrl: 'partial/docs/file.rename.html',
      controller: 'FileRename',
      resolve: {
        file: function () {
          return angular.copy(file);
        }
      }
    }).result.then(function (fileUpdated) {
      if (fileUpdated === null) {
        return;
      }

      // Rename the file
      Restangular.one('file/' + file.id).post('', {
        name: fileUpdated.name
      }).then(function () {
        file.name = fileUpdated.name;
      })
    });
  };
});