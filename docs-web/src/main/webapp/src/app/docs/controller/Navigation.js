'use strict';

/**
 * Navigation controller.
 */
angular.module('docs').controller('Navigation', function($scope, $state, $rootScope, User) {
  if(window.location.href.includes('/passwordreset/')){
    $scope.userInfo = {anonymous: true};
  } else {
    User.userInfo().then(function(data) {
      $rootScope.userInfo = data;
      if (data.anonymous) {
        $state.go('login', {}, {
          location: 'replace'
        });
      }
      $rootScope.isAdmin = data.base_functions.indexOf('ADMIN') !== -1;
    });
  }

  /**
   * User logout.
   */
  $scope.logout = function($event) {
    User.logout().then(function() {
      User.userInfo(true).then(function(data) {
        $rootScope.userInfo = data;
      });
      $state.go('main');
    });
    $event.preventDefault();
  };
});