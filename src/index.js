const electron = require('electron');
const {app, BrowserWindow, Menu} = require('electron');
const loki = require('./database');

const lazyRequire = require('lazy-require');
const os = lazyRequire('os');
const settings = lazyRequire('electron-settings');
const ipcMain = lazyRequire('electron').ipcMain;
const fs = lazyRequire('fs');
const util = lazyRequire('util');
const waterfall = lazyRequire('async-waterfall');
const path = lazyRequire('path');



// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
// An array to hold all of our subwindows
let windows = [];
// Boolean used to prevent windows from closing prematurely.
let isQuitting;
// For the lokijs instance
let db;

function setupMainWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600, show: false});

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/html/index.html');
  // If we don't have a global config, initialise it
  if( ! settings.get('global') )
  {
    initializeSettings();
  }
  else {
    // Otherwise, check for debug and report the file location.
    // We'll disable the debug menu in release.
    if ( settings.get('allTheDebugs') ) { mainWindow.webContents.openDevTools(); }
    console.log( 'Loading electronGun Settings from ' + settings.file() );
  }

  // Populate the menu object

  var application_menu = [
    {
      label: 'Application',
      submenu: [
        {
          label: 'Configuration',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            showSubWindow('configurationWindow','loadform', settings.getAll() );
          }
        },
        {
          label: 'Debug',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            if( ! settings.get( 'allTheDebugs' ) ) {
              settings.set('allTheDebugs', true );
              mainWindow.webContents.openDevTools();
            } else {
              settings.set('allTheDebugs', false );
              mainWindow.webContents.closeDevTools();
            }
          }
        }
      ]
    }
  ];
  if (process.platform == 'darwin') {
    const name = app.getName();
    application_menu.unshift({
      label: name,
      submenu: [
        {
          label: 'About ' + name,
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          label: 'Hide ' + name,
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => { app.quit(); }
        },
      ]
    });
  }

  // Attach the menu.
  let menu;

  menu = Menu.buildFromTemplate(application_menu);
  Menu.setApplicationMenu(menu);

  // Set up the ready-to-show window event.
  mainWindow.once('ready-to-show', () => {
    // Make the window visible
    mainWindow.show();
    // Close the splash screen
    windows['splashWindow'].close();
    // Load and display the mailing lists stored in the DB.
    loadLists();
  })

  // Set the close window event.
  mainWindow.on('close', function () {
    // Set the quitting global so that the subwindows will close.
    isQuitting = true;
    // Make sure we won't see debug windows next load.
    settings.set('allTheDebugs', false );
    // Close all the subwindows.
    closeSubwindows();
  });


  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    // Stall one second first. Should make sure the DB flushes.
    createTimeoutPromise( 1000, '', function () {  mainWindow = null; } );
  });
}

// Iterate through the subwindows and .close() any that are still around.
function closeSubwindows() {
    for ( var window in windows ) {
      if ( windows[ window ] ) {
        windows[ window ].close();
      }
  }
}

// Generic for creating new subwindows
function setupSubwindows( subWindow, browserWindowValues, htmlFile ) {
  // Create the browser window.
  windows[ subWindow ] = new BrowserWindow( browserWindowValues );

  // Load the html for rge window.
  windows[ subWindow ].loadURL('file://' + __dirname + '/html/' + htmlFile );

  // This should prevent close events from actually closing the window.
  // We don't want that to happen, we only want it to hide.
  windows[ subWindow ].on('onbeforeunload', function (e) {
    if( !isQuitting ){
      e.preventDefault();
      windows[ subWindow ].hide();
      e.returnValue = false;  // this will *prevent* the closing no matter what value is passed
      windows[ subWindow ].closeDevTools();
    }
  });

  // Null out the window array position after the window is closed.
  windows[ subWindow ].on('closed', function () {
      windows[ subWindow ] = null;
  });
}

// Generic function for bringing a subwindow to the top.
function showSubWindow( windowName, ipcAction, ipcArgs )
{
  // Make sure the windows is present.
  checkSubwindowStatus();
  // We need to stall a second - This is an unpleasant way to handle this, but no documented method for blocking Alt-F4 works.
  // This means we sometimes have to recreate the window, but we don't seem to be able to get it to process the ipcAction if
  // We don't stall out.
  createTimeoutPromise( 1000, '', function () {
    // Trigger the subwindow's update/repaint action if needed.
    if( ipcAction ) {
      windows[ windowName ].webContents.send( ipcAction, ipcArgs );
    }
    // Display the subwindow
    windows[ windowName ].show();
    // if debugging is on, show the subwindow's debugging instance.
    if ( settings.get('allTheDebugs') ) { windows[ windowName ].webContents.openDevTools(); }
  });
}

// The splash screen is a slight special case, so we don't use the generic setup.
function showSplash( ) {
  // This method will be called when Electron has done everything
  // initialization and ready for creating browser windows.
  app.on('ready', function() {
    // Create the browser window.
    windows['splashWindow'] = new BrowserWindow({width: 430, height: 225, frame: false, show: false });

    // and load the index.html of the app.
    windows['splashWindow'].loadURL('file://' + __dirname + '/html/splash.html');

    // Null out the array member once it's closed.
    windows['splashWindow'].on('closed', function () {
        windows['splashWindow'] = null;
    });
    // if ( settings.get('allTheDebugs') ) { windows['splashWindow'].webContents.openDevTools(); }
  });
}

// This is used by both the btn_closeUserManipWindow and launchEdit IPC events
// to load/reload the current mailing list for browsing/editing/etc.
function showMailingListEditWindow( hideManip ) {
  // If this is called by btn_closeUserManipWindow, hide the userManipulationWindow subwindow
  if( hideManip ) {
      windows['userManipulationWindow'].webContents.closeDevTools();
      windows['userManipulationWindow'].hide();
  }

  // Create an Object for passing to the listEdit subwindow
  let listObject = {};

  // Select lists collection.
  let lists = loki.db.getCollection('lists');
  // Find the active mailing list.
  var results = lists.find( {address: settings.get('mailingList') } );
  if( results.length > 0 ) {
    listObject.membersList = results[0].members;
  }
  // Populate the object.
  listObject.members_count = results[0].members_count;
  listObject.name = results[0].name;
  listObject.lastSynced = results[0].lastSynced;
  listObject.electronGunSettings = settings.getAll();
  // Show the listedit subwindow.
  showSubWindow('listEditWindow', 'loadList', listObject );
}

function createTimeoutPromise ( timeOut, passedValue, actions ) {
  // The util.promisify routines in the example docs are not right. Endrunning for now.
  const setTimeoutPromise = setTimeout( actions, timeOut, passedValue );
}

// Set up all of the IPC listeners.
function setupIPCListeners() {

  // Generics or multi-window
  //
  // Close Subwindow.
  ipcMain.on('btn_GenericCloseWindow', function( event, arg ) {
    windows[ arg ].hide();
    windows[ arg ].closeDevTools();
  });

  // Fire off the add user mode on the mailing list membership editing subwindow.
  ipcMain.on('btn_adduser', function ( event, arg ) {
    showSubWindow('userManipulationWindow', 'prepareAction', { settings: settings.getAll(), action: 'addUsers' } );
  });

  // Fire off the delete user mode on the mailing list membership editing subwindow.
  ipcMain.on('btn_deluser', function ( event, arg ) {
    showSubWindow('userManipulationWindow', 'prepareAction', { settings: settings.getAll(), action: 'delUsers' } );
  });

  // Main Window Panel Buttons

  // Opens up the Configuration Editing subwindow
  ipcMain.on('btn_config', function (event, arg) {
    showSubWindow('configurationWindow','loadform', settings.getAll() );
  });

  // Opens up the mailing list editing subwindow
  ipcMain.on('launchEdit', function( event, arg ) {
    showMailingListEditWindow( false );
  });

  // Store the results of resyncing the list of mailing lists on the account.
  ipcMain.on( 'syncedMailingLists', function( event, arg ) {
    // Get the lists collection
    let lists = loki.db.getCollection('lists');
    // Loop through each list found
    arg.forEach( function(list) {
      // Look and see if we already know about this list in the DB.
      var results = lists.find( {address: list.address} );
      // If found, update the name.
      if( results.length > 0 ) {
        results[0].name = arg.name;
        lists.update( results[0] );
      } else {
        // Otherwise, insert it.
        lists.insert( list );
      }
    })
  });

  // Configuration Editing subwindow actions
  //
  // Update the configuration settings and close the configuration window.
  ipcMain.on('updateElectronGunSettings', function (event, arg) {
    windows['configurationWindow'].hide();
    windows['configurationWindow'].closeDevTools();
    settings.set('pubkey', arg.pubkey );
    settings.set('apikey', arg.apikey );
  });

  // Mailing List Edit window Buttons
  //
  // Show the send email subwindow
  ipcMain.on('btn_sendMailWindow', function( event, arg ){
    showSubWindow( 'sendMailWindow', '', {} )
  });

  // Mail Editing window
  //
  // Preview the message being sent.
  ipcMain.on( "btn_previewMail", function( event, arg ) {
    showSubWindow('mailPreviewWindow','mailPreviewWindow', { preview: arg } );
  })

  // Mailing List Manipulation ( add/delete users ) subwindow
  //
  // Close the User Manipulation window and trigger a reload of the editing window.
  ipcMain.on('btn_closeUserManipWindow', function( event, arg ) {
    showMailingListEditWindow( true );
  })

  // Store the members of a mailing list in the database
  ipcMain.on('storeListMembers', function( event, arg ) {
    // Grab the lists collection
    let lists = loki.db.getCollection('lists');
    // Look up the mailing list
    var results = lists.find( {address: arg.address} );
    // If we already have stored the list in the DB
    if( results.length > 0 ) {
      // If we are adding a single member, push this to the exiting list
      if( arg.hasOwnProperty('newmember') ) {
        results[0].members.push(arg.newmember );
      } else if ( arg.hasOwnProperty('removemember') ) {
        // If we are removing a single member, find them in the list and remove them.
        for( var memberLoop = 0; memberLoop < results[0].members.length; memberLoop++)
          if ( results[0].members[ memberLoop ].address === arg.removemember.address )
          {
            results[0].members.splice( memberLoop, 1 );
            memberLoop = results[0].members.length + 2;
          }
      } else {
        // Otherwise, this is a wholesale replacement of the members list due to a resync
        results[0].members = arg.members;
        // Update the lastSynced as well.
        results[0].lastSynced = arg.lastSynced;
      }
      // Update the member's count
      results[0].members_count = results[0].members.length;
      // Update the document.
      lists.update( results[0] );
    } else {
      // Remove the newmember or removemember properties, if present.
      // It is possible that the first writes to teh storage will be from manual
      // additions rather than resyncs.
      if( arg.hasOwnProperty('newmember') ) {
        delete arg.newmember;
      } else if ( arg.hasOwnProperty('removemember') ) {
        delete arg.removemember;
      }
      // Add the members_count value
      arg.members_count = arg.members.length;
      // Insert the list.
      lists.insert( arg );
    }
    // Reload the edit window.
    showMailingListEditWindow( false );
  });
}

// Loop through the subwindows and recreate any that alt-F4'd
function checkSubwindowStatus() {
  // The list of windows?
  let subWindows = [ 'sendMailWindow', 'configurationWindow', 'listEditWindow', 'userManipulationWindow', 'mailPreviewWindow' ];
  // Iterate through the windows
  subWindows.forEach( function ( subWindow ) {
    // If the window is not in the array or the window object is null, recreate it.
    if ( (!(subWindow in windows)) || ( windows[ subWindow ] == null ) ) {
        setupSubwindows( subWindow, {width: 800, height: 400, frame: false, show: false }, subWindow + '.html' );
    }
  } );
}

function setupApp() {
  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    if (process.platform != 'darwin')
      app.quit();
  });
  // Set our global exit boolean to false
  isQuitting = false;

  // Show the Splash Screen
  windows['splashWindow'].show();

  // Waterfall through the timeouts.
  waterfall( [
    function(cb) {
      // Set a timeout so this step can be seen.
      createTimeoutPromise(500, 'Setting up Windows.', function(value) {
        // Update the Splash Screen
        windows['splashWindow'].webContents.send('updateLoading', value);
        // Run the setups for each window.
        setupMainWindow();
        checkSubwindowStatus();
        cb(null);
      });
    },
    function(cb) {
      createTimeoutPromise(250, 'Setting up Database.', function(value) {
        // Update the splash window.
        if( windows['splashWindow'] ) { windows['splashWindow'].webContents.send('updateLoading', value); }
        // Connect to the database
        loki.constructor(os.homedir()+'/.electronGun.json');
        cb(null);
      });
    },
    function(cb) {
      createTimeoutPromise(250, 'Setting up Listeners.', function(value) {
        // Update the splash window
        if( windows['splashWindow'] ) { windows['splashWindow'].webContents.send('updateLoading', value); }
        // Construct all of the IPCListeners
        setupIPCListeners();
        cb(null);
      });
    }
  ], null);
}

// Pull the list of mailinglists from the database and send it to the main window.
function loadLists()
{
  // Connect to the lists collection
  let lists = loki.db.getCollection('lists');
  // Query for the full document
  var results = lists.find( {} );
  // If we had any results, send it to the mainWindow via the loadLists IPC event.
  if ( results.length > 0 ) {
    mainWindow.webContents.send('loadedLists', results );
  }
}

function applicationMain() {
  // Wait for the Load App event and then set up the house.
  ipcMain.on('loadApp', function (event, arg) { setupApp(); } );
  // Make the Splash Screen visible.
  showSplash();
}

// Do the thing.
applicationMain();
