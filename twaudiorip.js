//
// Version 1.
//
// Windows version of a combined twaudiorip.sh / twaudiorip-runner.sh
// 
// Download the newest mp3 files from Twaud.io user.
// (Only those mp3's that are listed in the RSS feed.)
//
// This script will get usernames from a central tracker. It will keep
// running until it sees a file called STOP.txt in its directory.
//
// Usage:  cscript twaudiorip.js
//

var WshShell = WScript.CreateObject("WScript.Shell");
var FileSystemObject = new ActiveXObject("Scripting.FileSystemObject");


function runWget(wgetCommand) {
  // redirect stderr to stdout
  // http://www.digitalenginesoftware.com/blog/archives/27-WshShell.Exec-Considered-Harmful-Due-To-Blocking.html
  var wget = WshShell.Exec("%comspec% /c \""+wgetCommand+" 2>&1\"");

  var stdOut = "";
  var stdErr = "";

  while (wget.Status == 0) {
    if (!wget.StdOut.AtEndOfStream) {
      stdOut += wget.StdOut.ReadAll();
    }
    WScript.Sleep(100);
  }
  if (!wget.StdOut.AtEndOfStream) {
    stdOut += wget.StdOut.ReadAll();
  }

  return { Status:wget.Status, StdOut:stdOut, StdErr:stdErr };
}

function mkdirP(dir) {
  var dirParts = dir.split("\\");
  var curDir = WshShell.CurrentDirectory;
  for (var i=0; i<dirParts.length; i++) {
    curDir += "\\"+dirParts[i];
    if (!FileSystemObject.FolderExists(curDir)) {
      FileSystemObject.CreateFolder(curDir);
    }
  }
}



function readFile(file) {
  var f = FileSystemObject.OpenTextFile(WshShell.CurrentDirectory+"\\"+file, 1);
  var s = f.readAll();
  f.close();
  return s;
}

function folderExists(file) {
  return FileSystemObject.FolderExists(WshShell.CurrentDirectory+"\\"+file);
}

function fileExists(file) {
  return FileSystemObject.FileExists(WshShell.CurrentDirectory+"\\"+file);
}

function rmFile(file) {
  return FileSystemObject.DeleteFile(WshShell.CurrentDirectory+"\\"+file);
}



function downloadUser(username) {
  var userAgent = "Googlebot/2.1 (+http://www.googlebot.com/bot.html)"

  var dataDir = "data\\"+username.substring(0,1)+"\\"+
                         username.substring(0,2)+"\\"+
                         username.substring(0,3)+"\\"+
                         username.substring(0,4)+"\\"+
                         username;

  if (fileExists(dataDir+"\\incomplete.txt")) {
    WScript.Echo("Deleting incomplete download of "+username);
    WshShell.Exec("%comspec% /c \"del /q /s \""+WshShell.CurrentDirectory+"\\"+dataDir+"\"\"");
  }
  if (folderExists(dataDir)) {
    WScript.Echo("Already downloaded "+username);
    WScript.Quit();
  }

  WScript.Echo("Downloading "+username);
  mkdirP(dataDir);
  FileSystemObject.CreateTextFile(dataDir+"\\incomplete.txt", true);

  // grab profile page
  runWget("wget -nv -q -nc -U \""+userAgent+"\" -O "+dataDir+"\\index.html \"http://twaud.io/users/"+username+"\"");

  // grab rss feed
  runWget("wget -nv -q -nc -U \""+userAgent+"\" -O "+dataDir+"\\rss.xml \"http://twaud.io/users/"+username+".xml\"");

  var downloadFinished = false;
  while (!downloadFinished) {
    // find urls
    var rssData = readFile(dataDir+"\\rss.xml");
    var audioFiles = rssData.match(/http:\/\/twaud\.io\/audio\/[^<]+|http:\/\/s3\.amazonaws\.com\/twaudio-production[^"]+/g);

    downloadFinished = true;
    for (var i=0; i<audioFiles.length; i+=2) {
      var clipId = audioFiles[i].match(/[^\/]+$/);
      var url = audioFiles[i+1].replace(/&amp;/g,"&");

      WScript.Echo(" - clip "+clipId);
      if (!fileExists(dataDir+"\\"+clipId+".mp3")) {
        var wgetOut = runWget("wget -nc -U \""+userAgent+"\" -O \""+dataDir+"\\"+clipId+".mp3\" \""+url+"\" -S");
        if (!wgetOut.StdOut.match(/200 OK/)) {
          if (wgetOut.StdOut.match(/Forbidden/)) {
            WScript.Echo(" -- expired, redownload RSS feed for fresh signatures");
            rmFile(dataDir+"\\rss.xml");
            runWget("wget -nv -q -nc -U \""+userAgent+"\" -O \""+dataDir+"\\rss.xml\" \"http://twaud.io/users/"+username+".xml\"");
            downloadFinished = false;
            break;
          } else {
            WScript.Echo("ERROR: wget returned an error on "+url);
          }
        }
      }

      // download html
      runWget("wget -q -nc -U \""+userAgent+"\" -O \""+dataDir+"\\"+clipId+".html\" \"http://twaud.io/"+clipId+"\"");
    }
  }

  FileSystemObject.DeleteFile(dataDir+"\\incomplete.txt");

  WScript.Echo("Done");
}


function requestUsername() {
  WScript.Echo("Requesting username");
  var wgetOut = runWget("wget -nv -q -O - --post-data=\"\" \"http://twaudio-tracker.heroku.com/request\"");
  var usernamePlusRubbish = wgetOut.StdOut;
  return usernamePlusRubbish.replace(/SYSTEM_WGETRC(.|\r|\n)*/m, "");
}
function markUsernameDone(username) {
  WScript.Echo("Marking "+username+" done");
  var wgetOut = runWget("wget -nv -q -O - --post-data=\"\" \"http://twaudio-tracker.heroku.com/done/"+username+"\"");
  return wgetOut;
}




while (!fileExists("STOP.txt")) {
  WScript.Echo("");
  WScript.Echo("To stop the script, create a file called STOP.txt in "+WshShell.CurrentDirectory);
  WScript.Echo("");

  var username = requestUsername();
  if (username.match(/\S+/)) {
    downloadUser(username);
    markUsernameDone(username);
  } else {
    WScript.Echo("Nothing to be done.");
    WScript.Quit();
  }
}



