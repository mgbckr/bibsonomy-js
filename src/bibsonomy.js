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
	
	this.isLoginValid = function(callback) {
		var url = this.baseUrl + '/posts?resourcetype=bibtex&search=test&format=json';
		request(
			'GET',
			url, 
			null, 
			(e) => {callback(e, null, true)}, 
			(e) => {callback(e, null, false)}
		);
	}

	/**
	 */
	this.getUserPost = function(user, intraHash, callback) {

		var url = '/users/' + user + '/posts/' + intraHash + '?format=json';
		
		requestWithDefaultErrorHandling('GET', url, undefined, callback, function(e) {
			var json = JSON.parse(this.response);
			callback(e, null, json['post']);
		});
	}

	/**
	 * https://bitbucket.org/bibsonomy/bibsonomy/wiki/documentation/api/methods/ListOfAllPosts
	 * `resourceHash` seems to have to be the interHash
	 */
	this.getPosts = function(
			callback,
			resourceType="publication", 
			resourceHash=null, 
			tags=null,
			search=null,
			user=null, 
			group=null, 
			viewable=null, 
			sortKey=null,
			sortOrder=null) {

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

		requestWithDefaultErrorHandling('GET', url, undefined, callback, function(e) {
			var json = JSON.parse(this.response);
			callback(e, null, json['post']);
		});
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
	 * Post an actual bibtex entry.
	 */
	this.postBibtex = function(bibtex, tags, callback, user = null) {
		
		if (user === null) {
			user = this.user
		}

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
	this.updatePost = function(post, callback, user = null) {

		if (user === null) {
			user = this.user
		}

		var obj = {post: post}

		var hash = null
		if (post.bibtex) {
			hash = post.bibtex.intrahash
		} else if (post.bookmark) {
			hash = post.bookmark.intrahash
		} else {
			console.log("ERROR: no hash available in post")
		}

		var url =  "/users/" + user + "/posts/" + hash + "?format=json"
		requestWithDefaultErrorHandling('PUT', url, JSON.stringify(obj), callback, function(e) {
			var newHash = JSON.parse(this.response)["resourcehash"]
			if (post.bibtex) {
				post.bibtex.intrahash = newHash
			} else if (post.bookmark) {
				post.bookmark.intrahash = newHash
			}
			callback(e, null, post)
		})
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

	/**
	 * Helper function to shorten the HTTP request code.
	 */
	 var request = function(type, url, data, onload, onerror) {

		console.log(url)

		var xhr = new XMLHttpRequest();
		xhr.open(type, url, true);
		xhr.setRequestHeader('Authorization', 'XXXBasic ' + btoa(user + ':' + apiKey));
		xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest")
		xhr.setRequestHeader("Access-Control-Allow-Origin", "*");
		xhr.setRequestHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE,PUT");
		
		xhr.onload = onload
		
		if (onerror !== undefined) {
			xhr.onerror = onerror
		}
		
		xhr.send(data);
	}
	
	var requestWithDefaultErrorHandling = function(type, url, data, callback, onload) {

		// make onload parse JSON automatically

		if (onload === "parseJson") {
			onload = []
		}

		if (Array.isArray(onload)) {
			onload = function(e) {
				var json = JSON.parse(this.response);
				for (const key of onload) {
					json = json[key]
				}
				callback(e, null, json);
			}
		}

		// request resource 

		request(
			type,
			url,
			data,
			function(e) {
			
				// check if status corresponds to a "successful operation" / is a 2xx code
				var code = this.status - 200
				if (code >= 0 && code < 100) {
					onload.call(this, e)
				} else {
					callback(e, BibSonomy.ERROR_STATUS(this.status, this.response))
				}
			}, 
			function(e) {
				callback(e, BibSonomy.ERROR_NETWORK());
			});
	}
	
}

BibSonomy.ERROR_NETWORK = function() {
	return { type: 'network', msg: 'A network error occurred.' }
}

BibSonomy.ERROR_STATUS = function(status, response) {
	return { type: 'stats', msg: 'Response status not OK: ' + status, status: status, response: response}
}

/**
 * Get user name and API key directly from BibSonomy.
 * This only works if the user is logged in.
 * 
 * @param callback callback function
 * @param baseUrl URL to BibSonomy; default: https://www.bibsonomy.org
 */
BibSonomy.getUserdetails = function(callback, baseUrl = "https://www.bibsonomy.org") {

	var url = baseUrl + "/settings";
	
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	
	xhr.onload = function(e) {
		
		if (this.status === 200) {
			
			var parser = new DOMParser();
			var html = parser.parseFromString(this.response, "text/html");
			console.log(html)
			
			var userElement = html.getElementById("user.name");
			if (userElement) {
				var user = userElement.value;
				var apikey = html.querySelector(".form-control-static tt").innerHTML;
				callback(e, null, {user: user, apikey: apikey});
			} else {
				callback(e, BibSonomy.ERROR_STATUS(this.status, this.response));
			}
			
		} else {
			callback(e, BibSonomy.ERROR_STATUS(this.status, this.response));
		}
		
	};
	
	xhr.onerror = function(e) {
		callback(e, BibSonomy.ERROR_NETWORK());
	}
	
	xhr.send();
	
}
