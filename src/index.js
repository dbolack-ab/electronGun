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
let windows = [];
let isQuitting;
let backupSettings = {};
let db;

function setupMainWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600, show: false});

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/html/index.html');
  if ( settings.get('allTheDebugs') ) { mainWindow.webContents.openDevTools(); }

  if( ! settings.get('global') )
  {
    initializeSettings();
  }
  else {
    console.log( 'Loading electronGun Settings from ' + settings.file() );
    backupSettings = settings.getAll();
  }

  var application_menu = [
    {
      label: 'Application',
      submenu: [
        {
          label: 'Configuration',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            openConfiguration();
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

  let menu;

  menu = Menu.buildFromTemplate(application_menu);
  Menu.setApplicationMenu(menu);


  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    windows['splashWindow'].close();
    loadLists();
  })


  mainWindow.on('close', function () {
    isQuitting = true;
    settings.set('allTheDebugs', false );
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

function closeSubwindows() {
    for ( var window in windows ) {
      if ( windows[ window ] ) {
        windows[ window ].close();
      }
  }
}

function setupSubwindows( subWindow, browserWindowValues, htmlFile ) {
  // Create the browser window.
  windows[ subWindow ] = new BrowserWindow( browserWindowValues );

  // and load the index.html of the app.
  windows[ subWindow ].loadURL('file://' + __dirname + '/html/' + htmlFile );

  windows[ subWindow ].on('onbeforeunload', function (e) {
    if( !isQuitting ){
      e.preventDefault();
      windows[ subWindow ].hide();
      windows[ subWindow ].closeDevTools();
      e.returnValue = false;  // this will *prevent* the closing no matter what value is passed
    }
  });

  windows[ subWindow ].on('closed', function () {
      windows[ subWindow ] = null;
  });
}

function openConfiguration() {
  windows['ConfigWindow'].webContents.send('loadform', settings.getAll());
  windows['ConfigWindow'].show();
  if ( settings.get('allTheDebugs') ) { windows['ConfigWindow'].webContents.openDevTools(); }
}

function openUserManipulation(whichMode) {
  windows['userManipulation'].webContents.send('prepareAction', { settings: settings.getAll(), action: whichMode } );
  windows['userManipulation'].show();
  if ( settings.get('allTheDebugs') ) { windows['userManipulation'].webContents.openDevTools(); }
}

function showSplash( ) {
  console.log('ShowSplash: start');
  // This method will be called when Electron has done everything
  // initialization and ready for creating browser windows.
  app.on('ready', function() {
    // Create the browser window.
    windows['splashWindow'] = new BrowserWindow({width: 430, height: 225, frame: false, show: false });

    // and load the index.html of the app.
    windows['splashWindow'].loadURL('file://' + __dirname + '/html/splash.html');

    windows['splashWindow'].on('closed', function () {
        windows['splashWindow'] = null;
    });
    if ( settings.get('allTheDebugs') ) { windows['splashWindow'].webContents.openDevTools(); }
  });
}


function createTimeoutPromise ( timeOut, passedValue, actions ) {
  // The util.promisify routines in the example docs are not right. Endrunning for now.
  const setTimeoutPromise = setTimeout( actions, timeOut, passedValue );
}

function setupIPCListeners() {

  // Main Panel Buttons
  ipcMain.on('btn_config', function (event, arg) {
    openConfiguration();
  });

  ipcMain.on('btn_syncmaillists', function(event, arg) {
    mainWindow.webContents.send('passedElectronGunSettings', settings.getAll());
  });

  ipcMain.on('updateElectronGunSettings', function (event, arg) {
    windows['ConfigWindow'].hide();
    windows['ConfigWindow'].closeDevTools();
    settings.set('pubkey', arg.pubkey );
    settings.set('apikey', arg.apikey );
  });

  // Mailing List Edit window Buttons

  ipcMain.on('btn_GenericCloseWindow', function( event, arg ) {
    windows[ arg ].hide();
    windows[ arg ].closeDevTools();
  });

  ipcMain.on('btn_adduser', function ( event, arg ) {
    openUserManipulation('addUsers');
  });

  ipcMain.on('btn_deluser', function ( event, arg ) {
    openUserManipulation('delUsers');
  });

  ipcMain.on('btn_sendemail', function( event, arg ){
    windows['sendEmail'].show();
    if ( settings.get('allTheDebugs') ) { windows['sendEmail'].webContents.openDevTools(); }
  });

  // Mail Editing window

  ipcMain.on('btn_closeSend', function( event, arg ){
    windows['sendEmail'].close();
  });

  // Preview window

  // Mailing List manipulation

  ipcMain.on( "btn_previewMail", function( event, arg ) {
    console.log(arg);
    windows['mailPreview'].show();
    if ( settings.get('allTheDebugs') ) { windows['mailPreview'].webContents.openDevTools(); }
    windows['mailPreview'].webContents.send( 'mailPreview', { preview: arg })
  })

  ipcMain.on('btn_closeUserManipWindow', function( event, arg ) {
    let listObject = {}
    console.log( settings.get( 'mailingList' ) );
    listObject.electronGunSettings = settings.getAll();
    windows['userManipulation'].hide();
    windows['userManipulation'].closeDevTools();
    let lists = loki.db.getCollection('lists');
    var results = lists.find( {address: settings.get('mailingList')} );
    if( results.length > 0 ) {
      listObject.membersList = results[0].members;
    }
    listObject.members_count = results[0].members_count;
    listObject.name = results[0].name;
    listObject.lastSynced = results[0].lastSynced;
    windows['listEditWindow'].webContents.send('loadList', listObject);
  })


  ipcMain.on('launchEdit', function( event, arg ) {
    windows['listEditWindow'].show();
    if ( settings.get('allTheDebugs') ) { windows['listEditWindow'].webContents.openDevTools(); }
    let lists = loki.db.getCollection('lists');
    settings.set('mailingList', arg.address);
    var results = lists.find( {address: arg.address} );
    if( results.length > 0 ) {
      arg.membersList = results[0].members;
    }
    arg.members_count = results[0].members_count;
    arg.name = results[0].name;
    arg.lastSynced = results[0].lastSynced;
    arg.electronGunSettings = settings.getAll();
    windows['listEditWindow'].webContents.send('loadList', arg);
  });

  ipcMain.on( 'syncedMailingLists', function( event, arg ) {
    let lists = loki.db.getCollection('lists');
    arg.forEach( function(list) {
      var results = lists.find( {address: list.address} );
      if( results.length > 0 ) {
        results[0].name = arg.name;
        lists.update( results[0] );
      } else {
        lists.insert( list );
      }
    })
  });

  ipcMain.on('storeListMembers', function( event, arg ) {
    let lists = loki.db.getCollection('lists');
    var results = lists.find( {address: arg.address} );
    if( results.length > 0 ) {
      if( arg.hasOwnProperty('newmember') ) {
        results[0].members.push(arg.newmember );
      } else if ( arg.hasOwnProperty('removemember') ) {
        for( var memberLoop = 0; memberLoop < results[0].members.length; memberLoop++)
          if ( results[0].members[ memberLoop ].address === arg.removemember.address )
          {
            results[0].members.splice( memberLoop, 1 );
            memberLoop = results[0].members.length + 2;
          }
      } else {
        results[0].members = arg.members;
      }
      results[0].members_count = results[0].members.length;
      results[0].lastSynced = arg.lastSynced;
      lists.update( results[0] );
    } else {
      arg.members_count = arg.members.length;
      lists.insert( arg );
    }
    let reloadObject = {}
    reloadObject.electronGunSettings = settings.getAll();
    reloadObject.members_count = results[0].members_count;
    reloadObject.membersList = results[0].members;
    reloadObject.address = arg.address;
    reloadObject.lastSynced = arg.lastSynced;
    windows['listEditWindow'].webContents.send('loadList', reloadObject );
  });
}

function setupApp() {

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    if (process.platform != 'darwin')
      app.quit();
  });
  isQuitting = false;

  windows['splashWindow'].show();

  // Waterfall through the timeouts.

  waterfall( [
    function(cb) {
      createTimeoutPromise(250, 'Setting up Windows.', function(value) {
        windows['splashWindow'].webContents.send('updateLoading', value);
        setupMainWindow();
        setupSubwindows( 'sendEmail', {width: 800, height: 400, frame: false, show: false }, 'sendMail.html' );
        setupSubwindows( 'ConfigWindow', {width: 800, height: 400, frame: false, show: false }, 'config.html' );
        setupSubwindows( 'listEditWindow', {width: 800, height: 465, frame: false, show: false }, 'listView.html' );
        setupSubwindows( 'userManipulation', {width: 800, height: 400, frame: false, show: false }, 'userManip.html' );
        setupSubwindows( 'mailPreview', {width: 800, height: 400, frame: false, show: false }, 'mailPreview.html' );
        cb(null);
      });
    },
    function(cb) {
      createTimeoutPromise(250, 'Setting up Database.', function(value) {
        if( windows['splashWindow'] ) { windows['splashWindow'].webContents.send('updateLoading', value); }
        loki.constructor(os.homedir()+'/.electronGun.json');
        cb(null);
      });
    },
    function(cb) {
      createTimeoutPromise(250, 'Setting up Comms.', function(value) {
        if( windows['splashWindow'] ) { windows['splashWindow'].webContents.send('updateLoading', value); }
        setupIPCListeners();
        cb(null);
      });
    }
  ], null);
}

function loadLists()
{
  let lists = loki.db.getCollection('lists');
  var results = lists.find( {} );
  if ( results.length > 0 ) {
    mainWindow.webContents.send('loadedLists', results );
  }
}

function applicationMain() {
  // splash
  ipcMain.on('loadApp', function (event, arg) { setupApp(); } );
  showSplash();
}

applicationMain();
