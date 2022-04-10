// TODO: does not work the way I want it yet

const BibSonomy = require("../src/bibsonomy");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

// import BibSonomy from '../src/bibsonomy'

test("Test login", done => {
    var bib = new BibSonomy()
    bib.isLoginValid((e, error, loginValid) => {
        expect (!error && loginValid).toBe(true)
        done()
    })
});