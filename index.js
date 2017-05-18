var cli = require("commander");
var request = require("request");
var cheerio = require("cheerio");
var download = require('download');
var fs = require('fs');
var exec = require('child_process').exec;

var BASE_PATH = "http://www.ximalaya.com/tracks/";
var EXTENSION = ".json";
var REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:13.0) Gecko/20100101 Firefox/13.0',
};

var getHttpContent = function (loc){
    return new Promise(function (resolve, reject){
        request({
            url : loc,
            header: REQUEST_HEADERS
        },  function(err, httpResponse, body) {
            if (err){
                reject(err);
            } 

            resolve(body);
        });  
    }); 
};

cli.allowUnknownOption()
   .version(require("./package.json").version)
   .option("-l, --location [value]", "album location")
   .parse( process.argv ); 

var loc = cli.location;

var workDir = +new Date();

while (fs.existsSync(workDir + "/")){
    workDir = workDir + 1;
}

workDir = workDir + "/";
fs.mkdirSync(workDir);

getHttpContent(loc)
    .then(function (body){
        var $ = cheerio.load(body, { decodeEntities: false });

        var list = $("li[sound_id]").map(function (i, el){
            return BASE_PATH + $(el).attr("sound_id") + EXTENSION;
        }).toArray();

        var pros = list.map(function (el){ 
            return getHttpContent(el);
        });

        return Promise.all(pros);
    })
    .then(function (data){
        return data.map(function (el){
            el = JSON.parse(el);
            return {
                title: el.title,
                path: el.play_path,
                dest: workDir + el.title + "." + el.play_path.split(".").pop()
            };
        });
    })
    .then(function (list){
        var props = list.map(function (el){
            return download(el.path)
                .then(function (data){
                    fs.writeFileSync(el.dest, data)
                });
        });

        return Promise.all(props).then(function (){
            return list;
        });
    })
    .then(function (list){
        list.forEach(function (el){
            var cmd = "ffmpeg -i '" + el.dest + "' '" + workDir + el.title + ".mp3' -loglevel -8";
            
            exec(cmd, function (err, stdout, stderr){
                if (err){
                    console.log(err);
                }
                else{
                    fs.unlinkSync(el.dest);
                }
            });
        });
    });