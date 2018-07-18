'use strict';

/**
 * Zip Viewer Directive.
 */
angular.module('docs').directive('zipViewer', function() {
  return {
    restrict   : 'E',
    templateUrl: 'partial/docs/directive.zipviewer.html',
    replace    : true,
    scope      : {
      file: '='
    },
    controller : function($scope, $timeout) {
       $scope.fileList = {};
       $scope.canOpenWithDicomViewer = false;
       $scope.openInDicomViewer = function() {
         console.log('viewer');
         $scope.$parent.changeViewer('DicomViewer');
       };

      /**
       * Render byte to kilobyte
       * @param {Number} b
       */
      $scope.getKb = function(b) {
         return Math.round(b / 1024) + "KB";
       };

      if($scope.file.id) {
        JSZipUtils.getBinaryContent('../api/file/' + $scope.file.id + "/data", function(err, data) {
          if(err) {
            throw err;
          }

          JSZip.loadAsync(data).then(function(zip) {
            $scope.fileList = zip.files;
            var keyList = Object.keys(zip.files);
            for(var i = 0; i< keyList.length; i++) {
              if(keyList[i].match("\.dcm$")) {
                $scope.canOpenWithDicomViewer = true;
              }
            }
          });
        });
      }
    }
  }
});
