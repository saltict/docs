'use strict';

// check browser support
dwv.browser.check();

//====================================
// Setup i18n For Dicom Viewer
//====================================
dwv.i18nOnInitialised(function() {
  // call next once the overlays are loaded
  var onLoaded = function(data) {
    dwv.gui.info.overlayMaps = data;
  };

  // load overlay map info
  $.getJSON(dwv.i18nGetLocalePath("overlays.json"), onLoaded)
    .fail(function() {
      console.log("Using fallback overlays.");
      $.getJSON(dwv.i18nGetFallbackLocalePath("overlays.json"), onLoaded);
    });
});

dwv.i18nInitialise("auto", "static/dwv");

//====================================
// Setup Tools
//====================================
// Default colour maps.
dwv.tool.colourMaps = {
  "plain"       : dwv.image.lut.plain,
  "invplain"    : dwv.image.lut.invPlain,
  "rainbow"     : dwv.image.lut.rainbow,
  "hot"         : dwv.image.lut.hot,
  "hotiron"     : dwv.image.lut.hot_iron,
  "pet"         : dwv.image.lut.pet,
  "hotmetalblue": dwv.image.lut.hot_metal_blue,
  "pet20step"   : dwv.image.lut.pet_20step
};
// Default window level presets.
dwv.tool.defaultpresets = {};
// Default window level presets for CT.
dwv.tool.defaultpresets.CT = {
  "mediastinum": {"center": 40, "width": 400},
  "lung"       : {"center": -500, "width": 1500},
  "bone"       : {"center": 500, "width": 2000},
  "brain"      : {"center": 40, "width": 80},
  "head"       : {"center": 90, "width": 350}
};

//====================================
// Setup GUI
//====================================
// Window
dwv.gui.getWindowSize = function() {
  return {'width': ($(window).width()), 'height': ($(window).height() - 120)};
};

// Get Element

dwv.gui.getElement = dwv.gui.base.getElement;
// Refresh Element

dwv.gui.refreshElement = dwv.gui.base.refreshElement;

// Display Progress
dwv.gui.displayProgress = dwv.gui.base.displayProgress;

// Prompt
dwv.gui.prompt = dwv.gui.base.prompt;

// // Toolbox
dwv.gui.Toolbox = dwv.gui.base.Toolbox;

// ZoomAndPan
dwv.gui.ZoomAndPan = dwv.gui.base.ZoomAndPan;

// Scroll
dwv.gui.Scroll = dwv.gui.base.Scroll;

// DrawList
dwv.gui.DrawList = dwv.gui.base.DrawList;

// Draw
dwv.gui.Draw = dwv.gui.base.Draw;

// Draw
dwv.gui.Undo = dwv.gui.base.Undo;

//====================================
// Init Dicom Viewer
//====================================

// Image Decoder
dwv.image.decoderScripts = {
  "jpeg2000"     : "static/dwv/decoders/pdfjs/decode-jpeg2000.js",
  "jpeg-lossless": "static/dwv/decoders/rii-mango/decode-jpegloss.js",
  "jpeg-baseline": "static/dwv/decoders/pdfjs/decode-jpegbaseline.js"
};

dwv.finishConfig = true;

dwv.dicomIdCounter = 0;

/**
 * Dicom Viewer Directive.
 */
angular.module('docs').directive('dicomViewer', function() {
  return {
    restrict: 'E',
    templateUrl: 'partial/docs/directive.dicomviewer.html',
    replace: true,
    scope: {
      file: '='
    },
    controller: function($scope, $timeout, $translate) {
      $scope.dicomId = dwv.dicomIdCounter++;
      dwv.gui.getWindowSize = function() {
        return {'width': ($(window).width()), 'height': ($(window).height() - 135)};
      };

      $timeout(function() {
        dwv.i18nPage();
        // Option
        var dicomContainerId = 'dicom-viewer-' + $scope.dicomId;
        var options = {
          "containerDivId": dicomContainerId ,
          "fitToWindow"   : true,
          "gui"           : ["tool", "undo"],
          "loader"        : ["Url"],
          "tools"         : ["Scroll","ZoomAndPan", "Draw"],
          "shapes"        : ["Ruler", "Protractor", "Rectangle"]
        };

        var dicomViewer = new dwv.App();
        dicomViewer.init(options);

        var fileUrl = "../api/file/" + $scope.file.id + "/data";
        if($scope.file.mimetype === 'application/zip') {
          fileUrl += '?type=.zip'
        }
        dicomViewer.loadURLs([fileUrl]);
        dicomViewer.getElement('scrollLi').textContent = $translate.instant('directive.dicomviewer.scrollHelpText');

        $scope.$on('$destroy', function(e) {
          dicomViewer.abortLoad();
        });

        $scope.toggleInfo = function() {
          $scope.dicomViewer.toggleInfoLayerDisplay();
        };
      })
    },
    link: function(scope, element, attr, ctrl) {

    }
  }
});

/**
 * Simple dicom loader for thumb
 */
angular.module('docs').directive('dicomThumbnail', function() {
  return {
    restrict: 'E',
    templateUrl: 'partial/docs/directive.dicomviewer-thumb.html',
    replace: true,
    scope: {
      file: '='
    },
    controller: function($scope, $timeout) {
      $scope.dicomId = dwv.dicomIdCounter++;

      $timeout(function() {
        // Option
        var dicomContainerId = 'dicom-viewer-' + $scope.dicomId;
        var $containerDiv = $('#'+ dicomContainerId);
        dwv.gui.getWindowSize = function() {
          return {'width': $containerDiv.width(), 'height': $containerDiv.height()};
        };

        var options = {
          "containerDivId": dicomContainerId,
          "fitToWindow"   : true
        };

        var dicomViewer = new dwv.App();
        dicomViewer.init(options);
        dicomViewer.loadURLs(["../api/file/" + $scope.file.id + "/data"]);

        $scope.$on('$destroy', function(e) {
          dicomViewer.abortLoad();
        })
      })
    },
    link: function(scope, element, attr, ctrl) {
    }
  }
});