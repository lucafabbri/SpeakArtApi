'use strict';

const btoa = require('btoa');
const Hapi=require('hapi');
const fs = require('fs');
const request = require('request');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');
const mysql      = require('mysql');
const connection = mysql.createConnection({
    host : '127.0.0.1',
    user : 'speakartapi',
    password : 'Gc3mt_82',
    database : 'WizardSpeakartit'
});

const download = async function(uri, filename, callback){
  await request.head(uri, async function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    await request(uri).pipe(fs.createWriteStream(filename+'.jpg')).on('close', callback);
  });
};

// Create a server with a host and port
const server=Hapi.server({
    host:'localhost',
    port:8000,
    routes: {
        files: {
            relativeTo: Path.join(__dirname, 'results')
        }
    }
});

server.route({
method:'GET',
path:'/hello',
handler:function(request,h){
    return __dirname;
}
});

server.route({
    method: 'POST',
    path: '/compare',
    handler: async function(request,h){
        var load = request.payload;
        // var original = __dirname+'/originals/'+load.job+'.png';
        // var thenew = __dirname+'/news/'+load.job+'.png';
        var original = __dirname+load.urlOriginal;
        var thenew = __dirname+load.urlNew;
		var urlresult = __dirname+load.job;
        if(await fs.existsSync(original)&& await fs.existsSync(thenew)){

            console.log("loading files");
            var resultId = 3;
            await connection.query('INSERT INTO api_compare_results SET ?',{
                    url_original: load.urlOriginal,
                    url_new: load.urlNew,
                    max_threshold: load.maxThreshold,
                    url_result: load.job,
                    pixel_total: 0,
                    pixel_diff: 0,
                    status: "running"
                }, function (error, results, fields) {
                    if (error) console.log( error);
                    // Neat!
                    //console.log(results);
                    resultId = results.insertId;
                    console.log(resultId);
                    doneReading();
                });
            var img1 = fs.createReadStream(original).pipe(new PNG()).on('parsed', doneReading);
            var img2 = fs.createReadStream(thenew).pipe(new PNG()).on('parsed', doneReading);
            var filesRead = 0;

            async function doneReading() {
                console.log("files loaded "+filesRead+" for comparing");
                if (++filesRead < 3) return;

                console.log("files loaded "+filesRead+" for comparing");
                var diff = new PNG({width: img1.width, height: img1.height});
                console.log("ready for pixel matching");
                var pmresult = await pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, {threshold: load.maxThreshold});
                console.log(pmresult+" of "+img1.width*img1.height+" pixels found different, saving");
                await diff.pack().pipe(fs.createWriteStream(urlresult));

                await connection.query('UPDATE api_compare_results SET pixel_total = ?, pixel_diff = ?, status = ?, finished_at = CURRENT_TIMESTAMP() WHERE id = ?', [(img1.width*img1.height),pmresult,'finished',resultId.toString()],function (error, results, fields) {
                        if (error){ 
                            console.log(error);
                        }
                        // ...
                    });
            }
            return {"message":"compare started"};
        }
        else
        {
            return { "error":"JOB_IS_NOT_OVER","message":"Image upload is not completed yet"};
        }
    }
});

// Start the server
async function start() {

    try {

        await connection.connect(function(err) {
            if (err) {
                console.error('error connecting: ' + err.stack);
                return;
            }
            
            console.log('connected as id ' + connection.threadId);
        });
            

        await server.start();
    }
    catch (err) {
        console.log(err);
        process.exit(1);
    }

    console.log('Server running at:', server.info.uri);
};

start();