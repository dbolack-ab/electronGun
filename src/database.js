"use strict";
const loki = require('lokijs');

 module.exports.constructor = function ( dbName ) {
      exports.db = new loki(dbName, {
      	autoload: true,
      	autoloadCallback: databaseInitialize,
      	autosave: true,
      	autosaveInterval: 1000
    });
  };


  // Make sure the database exists etc.
function databaseInitialize() {
    var collections = [ 'lists', 'listusers' ];
    collections.forEach( function( colName ){
      let col = exports.db.getCollection(colName);
      if (col === null) {
        col = exports.db.addCollection(colName);
        var entryCount = exports.db.getCollection(colName).count();
      }
    });
}
