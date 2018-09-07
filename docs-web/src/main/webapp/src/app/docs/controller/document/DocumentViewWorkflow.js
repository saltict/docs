'use strict';

/**
 * Document view workflow controller.
 */
angular.module('docs').controller('DocumentViewWorkflow', function ($scope, $stateParams, Restangular, $translate, $dialog, $rootScope) {
  /**
   * Load routes.
   */
  $scope.loadRoutes = function () {
    Restangular.one('route').get({
      documentId: $stateParams.id
    }).then(function(data) {
      $scope.routes = data.routes;
      $scope.routes.forEach(function(route) {
        if(route.steps) {
          route.steps.forEach(function(step) {
            step.comment_config = JSON.parse(step.comment_config);
          })
        }
      })
    });
  };


  /**
   * Start the selected workflow
   */
  $scope.startWorkflow = function () {
    Restangular.one('route').post('start', {
      routeModelId: $scope.routemodel,
      documentId: $stateParams.id
    }).then(function (data) {
      data.route_step.comment_config =  JSON.parse(data.route_step.comment_config);
      $scope.document.route_step = data.route_step;
      $scope.loadRoutes();
    });
  };

  /**
   * Cancel the current workflow.
   */
  $scope.cancelWorkflow = function () {
    var title = $translate.instant('document.view.workflow.cancel_workflow_title');
    var msg = $translate.instant('document.view.workflow.cancel_workflow_message');
    var btns = [
      {result: 'cancel', label: $translate.instant('cancel')},
      {result: 'ok', label: $translate.instant('ok'), cssClass: 'btn-primary'}
    ];

    $dialog.messageBox(title, msg, btns, function (result) {
      if (result === 'ok') {
        Restangular.one('route').remove({
          documentId: $stateParams.id
        }).then(function () {
          delete $scope.document.route_step;
          $scope.loadRoutes();
        });
      }
    });
  };

  /**
   * Detect current user can view workflow or not
   * @param commentConfig
   */
  $scope.canViewComment = function(step) {
    var commentConfig = step.comment_config;
    var userInfo = $rootScope.userInfo;
    var username = userInfo.username;
    var groups = userInfo.groups;

    if(username === step.validator_username) {
      return true;
    }

    if(commentConfig) {
      var blindWith = commentConfig.blindWith || [];

      for(var i = 0; i < blindWith.length; i++ ) {
        var blindItem = blindWith[i];
        if(('USER' == blindItem.type && username == blindItem.name) || ('GROUP' == blindItem.type && groups.indexOf(blindItem[name]) > -1)) {
          return false;
        }
      }
    }

    return true;
  };

  $scope.canEditComment = function(step, route) {
    var userInfo = $rootScope.userInfo;
    var username = userInfo.username;
    var canedit = username === step.validator_username;

    if(!canedit) {
      return canedit;
    }

    if(step.comment_config.allowEdit == 'not_alow'){
      return false;
    } else if(step.comment_config.allowEdit == 'incomplete') {
      var allfill = true;
      route.steps.forEach(function(istep) {
          allfill = !!istep.transition;
      });
      if(allfill) {
        return false;
      }
    }

    return !step.editingComment;
  };

  $scope.editComment = function(step) {
    step.comment_old = step.comment;
    step.transition_old = step.transition;
    step.transition = '';
    step.editingComment = true;
  };

  $scope.cancelEditComment = function(step) {
    step.editingComment = false;
    step.comment = step.comment_old;
    step.transition = step.transition_old;
  };

  $scope.updateWorkflowStep = function(step, type){
    Restangular.one('route').post('updatestep', {
      documentId: $stateParams.id,
      routeStepId: step.id,
      transition: type,
      comment: step.comment
    }).then(function (data) {
      $scope.loadRoutes();
    });
    step.editingComment = false;
  };

  // Load route models
  Restangular.one('routemodel').get().then(function(data) {
    $scope.routemodels = data.routemodels;
  });

  // Load routes
  $scope.loadRoutes();
});