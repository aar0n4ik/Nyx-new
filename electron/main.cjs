const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
let srv;
const ROOT = app.isPackaged ? app.getAppPath() : path.join(__dirname,'..');
function startServer(){
  srv = spawn(process.execPath, [path.join(ROOT,'server.js')], {
    cwd: ROOT,
    env: {...process.env, NYX_PORT:'3000', ELECTRON_RUN_AS_NODE:'1'}, stdio:'inherit'
  });
}
function wait(cb,n=0){ http.get('http://localhost:3000/',()=>cb()).on('error',()=>{ if(n>120)return cb(); setTimeout(()=>wait(cb,n+1),500); }); }
function win(){ const w=new BrowserWindow({width:1240,height:840,title:'Nyx',autoHideMenuBar:true,backgroundColor:'#0a0e14'}); w.loadURL('http://localhost:3000/app'); }
app.whenReady().then(()=>{ startServer(); wait(()=>win()); });
app.on('window-all-closed',()=>{ if(srv)srv.kill(); app.quit(); });
