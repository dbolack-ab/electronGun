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
  //mainWindow.webContents.openDevTools();

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
            mainWindow.webContents.openDevTools();
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
    // Force close the hidden windows.
    // For some reason, this won't forEach();
    windows['ConfigWindow'].close();
    windows['listEditWindow'].close();
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

function setupListEditWindow() {
  // Create the browser window.
  windows['listEditWindow'] = new BrowserWindow({width: 800, height: 465, frame: false, show: false });

  // and load the index.html of the app.
  windows['listEditWindow'].loadURL('file://' + __dirname + '/html/listView.html');

  windows['listEditWindow'].on('onbeforeunload', function (e) {
    if( !isQuitting ){
      e.preventDefault();
      windows['listEditWindow'].hide();
      e.returnValue = false;  // this will *prevent* the closing no matter what value is passed
    }
  });

  windows['listEditWindow'].on('closed', function () {
      windows['listEditWindow'] = null;
  });

}


function setupConfigurationWindow() {
  // Create the browser window.
  windows['ConfigWindow'] = new BrowserWindow({width: 800, height: 400, frame: false, show: false });

  // and load the index.html of the app.
  windows['ConfigWindow'].loadURL('file://' + __dirname + '/html/config.html');

  windows['ConfigWindow'].on('onbeforeunload', function (e) {
    if( !isQuitting ){
      e.preventDefault();
      windows['ConfigWindow'].hide();
      e.returnValue = false;  // this will *prevent* the closing no matter what value is passed
    }
  });

  windows['ConfigWindow'].on('closed', function () {
      windows['ConfigWindow'] = null;
  });

}

function openConfiguration() {
  windows['ConfigWindow'].webContents.send('loadform', settings.getAll());
  windows['ConfigWindow'].show();
  windows['ConfigWindow'].webContents.openDevTools();
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
    // windows['splashWindow'].webContents.openDevTools();
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

  ipcMain.on('updateElectronGunSettings', function (event, arg) {
    windows['ConfigWindow'].hide();
    settings.set('pubkey', arg.pubkey );
    settings.set('apikey', arg.apikey );
  });

  ipcMain.on('closeElectronGunSettings', function (event, arg ) {
    windows['ConfigWindow'].hide();
  });

  ipcMain.on('launchEdit', function( event, arg ) {
    arg.electronGunSettings = settings.getAll();
    windows['listEditWindow'].show();
    windows['listEditWindow'].webContents.openDevTools();
    let lists = loki.db.getCollection('lists');
    var results = lists.find( {address: arg.address} );
    if( results.length > 0 ) {
      arg.membersList = results[0].members;
    }
    arg.members_count = results[0].members_count;
    arg.name = results[0].name;
    windows['listEditWindow'].webContents.send('loadList', arg);

  });

  ipcMain.on('fetchElectronGunSettings', function(event, arg) {
    mainWindow.webContents.send('passedElectronGunSettings', settings.getAll());
  });

  ipcMain.on('closeListWindow', function( event, arg ) {
    windows['listEditWindow'].hide();
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
      results[0].members = arg.members;
      lists.update( results[0] );
    } else {
      lists.insert( arg );
    }

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
        setupConfigurationWindow();
        setupListEditWindow();
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
    console.log( "Sending " + results );
    mainWindow.webContents.send('loadedLists', results );
  }
}

function applicationMain() {
  // splash
  ipcMain.on('loadApp', function (event, arg) { setupApp(); } );
  showSplash();
}

applicationMain();
