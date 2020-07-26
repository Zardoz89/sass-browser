"use strict";
/* sass-browser.js - v0.1.0
 */

/**
 * Returns all the hrefs of all <link> tags with rel == "stylesheet/scss"
 * */
function getAllScssSheets() {
  let sheets = [];

  const links = document.querySelectorAll('link');

  links.forEach(link => {
    if (link.rel === 'stylesheet/scss') {
      sheets.push(link);
    }
  });
  sheets = sheets.map(function (sheet) {
    return sheet.getAttribute("href");
  });

  return sheets;
}

/**
 * Try to resolve a import and downdload the apropiated file. If the file isn't found
 * tries to use alternative namaes following this list (for @import "hello/world";) :
 *
 * (1) filename as given -> "hello/world"
 * (2) underscore + given -> "hello/_world"
 * (3) underscore + given + scss extension-> "hello/_world.scss"
 * (4) underscore + given + sass extension-> "hello/_world.sass"
 * (5) underscore + given + css extension-> "hello/_world.css"
 */
async function resolveAndDownloadFile (href, debugLog) {
  let result = await getRemoteFile(href);
  if (result.error) {
    const hrefUnderscore = addUnderscore(href);
    result = await getRemoteFile(hrefUnderscore, debugLog);
    if (result.error) {
      if (!hrefUnderscore.endsWith(".scss")) {
        result = await getRemoteFile(hrefUnderscore + ".scss", debugLog);
      }
      if (result.error) {
        if (!hrefUnderscore.endsWith(".sass")) {
          result = await getRemoteFile(hrefUnderscore + ".sass", debugLog);
        }
        if (result.error) {
          if (!hrefUnderscore.endsWith(".css")) {
            result = await getRemoteFile(hrefUnderscore + ".css", debugLog);
          }
        }
      }
    }
  }
  return result;
}

/**
 * Fetchs a file and returns an object with the text content or an error
 */
async function getRemoteFile(href, debugLog) {
  if (debugLog) {
    console.log("to retrive : " , href);
  }
  try {
    let response = await fetch(href, { headers: new Headers({'Content-Type': 'text/x-scss'}) });
    if (!response.ok || response.headers.get("Content-Type").startsWith("text/html")) {
      if (debugLog) {
        console.warn("fetch response : ", response);
      }
      throw new Error(response.status + " : " + response.statusText + " " + href);
    }
    let content = await response.text();
    return {content: content};

  } catch(ex) {
    return {error: ex.message};
  }
}

/**
 * Adds the underscore to a filename
 */
function addUnderscore(href) {
  const filenameStart = href.lastIndexOf('/') + 1;
  let filename = href.substring(filenameStart);
  if (!filename.startsWith("_")) {
    filename = "_" + filename
  }
  if (filenameStart > 0) {
    return href.substring(0, filenameStart) + filename;
  } else {
    return filename;
  }
}

(function() {
  const debugLog = window.sassOptions && window.sassOptions.debug;
  const sass = new Sass();

  // We define the importer funcion to try to load the source files using fetch
  sass.importer(function(request, done) {
    if (debugLog) {
      console.log("importer request: " , request);
    }
    if (request.path) {
      // Sass.js already found a file, we probably want to just load that
      done();

    } else if (request.current) {
      // We try to get the file, doing http petitions relative to the actual URL
      const href = request.resolved.replace("/sass/", "");
      resolveAndDownloadFile(href, debugLog).then(result => {
        // Avoid problems when we have many files at different levels
        if (!result.error) {
          result.path = request.resolved;
        }
        done(result);
      });

    } else {
      // let libsass handle the import
      done();
    }
  });

  // Default options
  let options = {
    comments: true,
    sourceMapEmbed: true,
    sourceMapContents: true,
    sourceMapOmitUrl: false
  };
  if (window.sassOptions) {
    if (typeof window.sassOptions.comments !== "undefined") {
      options.comments = window.sassOptions.comments == true;
    }
    if (typeof window.sassOptions.sourceMaps !== "undefined") {
      options.sourceMapEmbed = window.sassOptions.comments == true;
      options.sourceMapContents = options.sourceMapEmbed;
    }
  }

  sass.options(options, function callback() {

    // Configured optiones, we try to compile all scss stylesheets on the page
    const sheets = getAllScssSheets();
    for (const sheet of sheets) {
      // Workaround to not use sass.compileFile that actually not works well with a custom importer function.
      // Instead, we set stdin to import the SCSS stylesheet
      sass.compile('@import "' + sheet  + '";', compilationResult => {
        if (compilationResult.status === 0) {
          console.log("compile file : ", sheet, " ", compilationResult);
          const head = document.head || document.getElementsByTagName('head')[0];
          const style = document.createElement('style');

          head.appendChild(style);

          style.type = 'text/css';
          style.appendChild(document.createTextNode(compilationResult.text));
        } else {
          console.error("compile : ", compilationResult);
        }
      });
    }
  });
})();

