// Start a Hoodie app
var fs = require("fs");
var http_proxy = require("http-proxy");
var hoodie_server = require("./hoodie-server");
var MultiCouch = require("multicouch");

var ltld;
try {
  ltld = require("local-tld");
  // TODO: check min version 2.0.0
} catch(e) {
  ltld = null;
}

var host = "0.0.0.0";
var http_port = parseInt(process.env.port, 10) || 80;
var domain = "dev";

var package_json = JSON.parse(fs.readFileSync("./package.json"));
var couchdb_url = process.env.couchdb_url;
var name = package_json.name;

var home = process.env.HOME;

if(ltld) {
  var http_port = ltld.getPort(name);
  var couch_port = ltld.getPort("couch." + name);
}

// if we are on nodejitsu, we require couch_url.
if(process.env.SUBDOMAIN) { // we are on nodejitsu
  domain = "jit.su";
  // TODO: verify couchdb_url is reachable
} else {
  console.log("Start local couch on port: %d", couch_port);
  // prepare hoodir dirs if they don’t exist:
  // mkdir -p $HOME/Application Support/Hoodie/Apps/myapp/
  mkdir_p(home + "/Library/Hoodie");
  mkdir_p(home + "/Library/Hoodie/Apps");
  mkdir_p(home + "/Library/Hoodie/Apps/" + package_json.name);
  // if we are not on nodejitsu, make us a couch
  var couchdb = new MultiCouch({
    prefix: home + "/Library/Hoodie/Apps/" + package_json.name,
    port: couch_port
  });

  couchdb.on("start", function() {
    console.log("CouchDB Started");
  });

  couchdb.on("error", function(error) {
    console.log("CouchDB Error: %j", error);
  });

  process.on("exit", function() {
    couchdb.stop();
    console.log("CouchDB stop triggered by exit");
  });

  // on ctrl-c, stop couchdb first, then exit.
  process.on("SIGINT", function() {
    couchdb.on("stop", function() {
      process.exit(0);
    });
    couchdb.stop();
  });

  couchdb.start();
}


var hoo = new hoodie_server(couchdb, package_json.name, domain);
// start frontend proxy
var server = http_proxy.createServer(hoo);
server.listen(http_port, function() {
  console.log("hoodie server started on port '%d'", port);
  console.log("Your app is ready now.");
});


var worker_names = [];
var deps = package_json.dependencies;
for(var dep in deps) {
  if(dep.substr(0, 7) == "worker-") {
    worker_names.push(dep);
  }
}

// for each package_json/worker*
var workers = worker_names.map(function(worker_name) {
  console.log("starting: '%s'", worker_name);
  // start worker
  var worker = require(worker_name);
  return new worker(process.env);
});
console.log("All workers started.");


function mkdir_p(dir) {
  try {
    fs.mkdirSync(dir);
  } catch(e) {
    // nope
  }
}