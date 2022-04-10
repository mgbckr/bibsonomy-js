/**
 * @OnlyCurrentDoc
 *
 * The above comment directs Apps Script to limit the scope of file
 * access for this add-on. It specifies that this add-on will only
 * attempt to read or modify the files in which the add-on is used,
 * and not all of the user's files. The authorization request message
 * presented to users will reflect this limited scope.
 */

/**
 * @example
 * var bib = new BibSonomy("username", "a6d04gg88d2af32ad18592a45e4b411a")
 * @example
 * var bib = new BibSonomy("username", "a6d04gg88d2af32ad18592a45e4b411a", "https://bibsonomy.org/api")
 */
function BibSonomy(user, apiKey, baseUrl = "https://www.bibsonomy.org/api") {
	
	this.user = user;
	this.apiKey = apiKey;
	this.baseUrl = baseUrl;
	
	var requestWithDefaultErrorHandling = function(method, url, data, userContext = false, parseDataOnOk=false) {
		
		// build url
		if (userContext) {
			url = '/users/' + user + url
		}
		url = baseUrl + url
    console.log(url)

    var options = {
      'method': method,
      'headers': {
        'Authorization': 'Basic ' + Utilities.base64Encode(user + ':' + apiKey)
      },
      'payload': data,
      'muteHttpExceptions': true
    }
    var response = UrlFetchApp.fetch(url, options);

    // check if status corresponds to a "successful operation" / is a 2xx code
    var code = response.getResponseCode() - 200
    if (code >= 0 && code < 100) {
      var response = BibSonomy.RESPONSE_OK(response)
      if (parseDataOnOk) {
        response.data = JSON.parse(response.response.getContentText())
      }
      return response
    } else {
      return BibSonomy.RESPONSE_ERROR_STATUS(response.getResponseCode(), response)
    }
	}
	
  this.isLoggedIn = function() {
    var response = this.searchResources("bibtex", ["sys:test-logged-in"], search=false)
    return response.type == "ok"
  }

	/**
   * Get user post by intrahash.
	 */
	this.getUserPost = function(user, intraHash) {
		var url = '/users/' + user + '/posts/' + intraHash + '?format=json';
		return requestWithDefaultErrorHandling('GET', url, undefined, false, parseDataOnOK=true);
	}

  this.getPosts = function(
      resourceType="publication", 
      resourceHash=null, 
      tags=null,
      search=null,
      user=null, 
      group=null, 
      viewable=null, 
      sortKey=null,
      sortOrder=null) {
    /**
     * https://bitbucket.org/bibsonomy/bibsonomy/wiki/documentation/api/methods/ListOfAllPosts
     * `resourceHash` seems to have to be the interHash
     */
		var url = '/posts?format=json';
    url += "&resourcetype=" + resourceType; 
    if (resourceHash !== null) url += "&resource=" + resourceHash;
    if (tags !== null) url += "&tags=" + tags.join("+");
    if (search !== null) url += "&search=" + search; 
    if (user !== null) url += "&user=" + user; 
    if (group !== null) url += "&group=" + group; 
    if (viewable !== null) url += "&viewable=" + viewable; 
    if (sortKey !== null) url+= "&sortkey=" + sortKey;
    if (sortOrder !== null) url+= "&sortorder=" + sortOrder;

		return requestWithDefaultErrorHandling('GET', url, null, userContext=false, parseDataOnOk=true);
	}

  /**
   * Search resource (which could be 'bibtex' or a 'bookmark').
   * Search can be done by tags (`search=False`) or an actual search `search=True`.
   */
  this.searchResources = function(resourceType, query, search) {
    
    var url = "/posts?user=" + user + "&resourcetype=" + resourceType + "&format=json"
    if (!search) {
      url += "&tags=" + query.join("+");
    } else {
      url += "&search=" + query;
    }

		return requestWithDefaultErrorHandling('GET', url, data=null, userContext=false, parseDataOnOk=true);
  }

	/**
	 * Post a bibtex entry.
	 */
	this.postBibtex = function(user, bibtex, tags, callback) {
		
		var content = {
			"post": {
				"bibtex": {
					"author": "x",
					"bibtexKey": "x",
					"entrytype": "x",
					"title": "x",
					"year": "x",
				},
				"group": [{ "name": "public" }],
				"tag": tags.map(function(t) { return { "name": t }; }),
				"user": { "name": user },
				"description": "",
				"publicationFileUpload": {
					"multipartName": "bibtex"
				}
			}
		};
		
		var data = new FormData();
		data.append("main", new Blob([JSON.stringify(content)], { type: "application/json"}));
		data.append("bibtex", new Blob([bibtex], { type: "text/bibtex" }));
		
		var url = '/users/' + user + '/posts?format=json';
		requestWithDefaultErrorHandling('POST', url, data, callback, function(e) {
			var json = JSON.parse(this.response)
			callback(e, null, json["resourcehash"])
		});
		
	}

	// update post
	this.updatePost = function(post, callback, sync = false) {

		var obj = {post: post}

		var hash = null
		if (post.bibtex) {
			hash = post.bibtex.intrahash
		} else if (post.bookmark) {
			hash = post.bookmark.intrahash
		} else {
			console.log("ERROR: no hash available in post")
		}

		var url =  "/posts/" + hash + "?format=json"
		requestWithDefaultErrorHandling('PUT', url, JSON.stringify(obj), callback, function(e) {
			var newHash = JSON.parse(this.response)["resourcehash"]
			if (post.bibtex) {
				post.bibtex.intrahash = newHash
			} else if (post.bookmark) {
				post.bookmark.intrahash = newHash
			}
			callback(e, null, post)
		}, true)
	}
	
	/**
	 * Add a file to an existing post.
	 * 
	 * @example
	 * bib.addFile(
	 * 		"becker", 
	 * 		"a6871ae6f57ce68d99d8c398c5ade867", 
	 * 		new Blob(["hallo"]), 
	 * 		"test.txt", 
	 * 		function(e) { console.log(e) })
	 * 
	 * @param user: 		the user the post belongs to
	 * @param resourceHash: the hash of the resource to add the file to
	 * @param file: 		the file contents
	 * @param filename: 	the name of the file as it should appear on BibSonomy
	 * @param callback: 	the function called after the request is finished: callback(requestData, fileHash)
	 */
	this.addFile = function(user, resourceHash, file, filename, callback) {

		var url = this.baseUrl + '/users/' + user + '/posts/' + resourceHash + '/documents/?format=json'
		
		var data = new FormData();
		data.append("file", file, filename);
		data.append("fileId", 1);
		
		requestWithDefaultErrorHandling('POST', url, data, callback, function(e) {
			var json = JSON.parse(this.response);
			var fileHash = json["resourcehash"];
			callback(e, null, fileHash);
		});
	}
	
	this.deletePost = function(user, resourceHash, callback) {
		var url = this.baseUrl + '/users/' + user + "/posts/" + resourceHash + '?format=json';
		requestWithDefaultErrorHandling('DELETE', url, null, callback, function(e) {
			var json = JSON.parse(this.response);
			callback(e, null, json);
		});
	}
	
}

BibSonomy.RESPONSE_OK = function(response) {
	return { type: "ok", response: response}
}

BibSonomy.RESPONSE_ERROR_NETWORK = function() {
	return { type: 'error', error_type: 'network', msg: 'A network error occurred.' }
}

BibSonomy.RESPONSE_ERROR_STATUS = function(status, response) {
	return { type: 'error', error_type: 'status', msg: 'Response status not OK: ' + status, status: status, response: response}
}

/**
 * Get user name and API key directly from BibSonomy.
 * This only works if the user is logged in.
 * 
 * @param callback callback function
 * @param baseUrl URL to BibSonomy; default: https://www.bibsonomy.org
 */
BibSonomy.getUserDetails = function(callback, baseUrl = "https://www.bibsonomy.org") {

  throw "Does not work in Google Apps Script since this is not browser request."

	// var url = baseUrl + "/settings";

  // var options = {
  //   'method': "GET",
  //   'muteHttpExceptions': true
  // }
  // var response = UrlFetchApp.fetch(url, options);

  // // check if status corresponds to a "successful operation" / is a 2xx code
  // var code = response.getResponseCode()

  // if (code == 200) {

  //   var html = response.getContentText().replace(/(\r\n|\n|\r)/gm, "");
  //   Logger.log(/<input id="username".*?>/g.exec(html))   
  //   var user = /<input id="user.name" .*?value="(.*?)">/g.exec(html)[1]
  //   var apikey = /<legend>API.*?<tt>(.*?)<\/tt>/g.exec(html)[1]
  //   var result = BibSonomy.RESPONSE_OK(response)
  //   result.data = {user: user, apikey: apikey};
  //   return result

  // } else {
  //   return BibSonomy.RESPONSE_ERROR_STATUS(response.getResponseCode(), response)
  // }

}

function test() {
  BibSonomy.getUserDetails()
}