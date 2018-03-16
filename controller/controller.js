//Dependencies
var express = require('express');
var router = express.Router();
var path = require('path');

//For the scrape we require request and cheerio
var request = require('request');
var cheerio = require('cheerio');

//Models required
var Comment = require('../models/Comment.js');
var Article = require('../models/Article.js');

//index
router.get('/', function(req, res) {
    res.redirect('/articles');
});

//Testing testing 1, 2, 3?
// router.get('/test-scrape', function(req, res) {
//   request(result.link, function(error, response, html) {
//     var $ = cheerio.load(html);

//     $('.l-col__main').each(function(i, element){
//       var result = {};

//       console.log($(this).children('.c-entry-content').children('p').text());
//     });
//   });
// });

// GET request to scrape website
router.get('/scrape', function(req, res) {
    //Request grabs the body of the HTML
    request('http://www.theverge.com/tech', function(error, response, html) {
        // Loads into cheerio and saves to $ for a shorthand selector
        var $ = cheerio.load(html);
        var titlesArray = [];
        // Grabs each article
        $('.c-entry-box--compact__title').each(function(i, element) {
            // Save an empty result object
            var result = {};

            // Adds text and href of each link, saves them as properties of the result object
            result.title = $(this).children('a').text();
            result.link = $(this).children('a').attr('href');

            //So no empty links or titles are sent to mongodb
            if(result.title !== "" && result.link !== ""){
              //Weeds out duplicates
              if(titlesArray.indexOf(result.title) == -1){

                // Saved titles pushed to array 
                titlesArray.push(result.title);

                // Adds article if it doesn't already exist
                Article.count({ title: result.title}, function (err, test){
                    //if the test is 0, the entry is unique and good to save
                  if(test == 0){

                    //Creates new object using article
                    var entry = new Article (result);

                    // Toss entry to mongodb
                    entry.save(function(err, doc) {
                      if (err) {
                        console.log(err);
                      } else {
                        console.log(doc);
                      }
                    });

                  }
            });
        }
        // Log that scrape is working, but article already exists
        else{
          console.log('Article already exists.')
        }

          }
          // Log that scrape is working, parts of data missing
          else{
            console.log('Not saved to DB, missing data')
          }
        });
        // After scrape, goes to index
        res.redirect('/');
    });
});

// Grab articles, populate DOM
router.get('/articles', function(req, res) {
    // Forces new articles to top
    Article.find().sort({_id: -1})
        // Shoot to handlebars
        .exec(function(err, doc) {
            if(err){
                console.log(err);
            } else{
                var artcl = {article: doc};
                res.render('index', artcl);
            }
    });
});

// Turns articles scraped from mongoDB into JSON
router.get('/articles-json', function(req, res) {
    Article.find({}, function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            res.json(doc);
        }
    });
});

// Clear all articles for test
router.get('/clearAll', function(req, res) {
    Article.remove({}, function(err, doc) {
        if (err) {
            console.log(err);
        } else {
            console.log('removed all articles');
        }

    });
    res.redirect('/articles-json');
});

router.get('/readArticle/:id', function(req, res){
  var articleId = req.params.id;
  var hbsObj = {
    article: [],
    body: []
  };

    // Find the article at id
    Article.findOne({ _id: articleId })
      .populate('comment')
      .exec(function(err, doc){
      if(err){
        console.log('Error: ' + err);
      } else {
        hbsObj.article = doc;
        var link = doc.link;
        //grab article from link
        request(link, function(error, response, html) {
          var $ = cheerio.load(html);

          $('.l-col__main').each(function(i, element){
            hbsObj.body = $(this).children('.c-entry-content').children('p').text();
            // Send article body and comments to article.handlbars through hbObj
            res.render('article', hbsObj);
            // Prevents loop through so it doesn't return an empty hbsObj.body
            return false;
          });
        });
      }

    });
});

// Create a new comment
router.post('/comment/:id', function(req, res) {
  var user = req.body.name;
  var content = req.body.comment;
  var articleId = req.params.id;

  // Comment Submitted 
  var commentObj = {
    name: user,
    body: content
  };
 
  // Using the Comment model to create a new comment
  var newComment = new Comment(commentObj);

  newComment.save(function(err, doc) {
      if (err) {
          console.log(err);
      } else {
          console.log(doc._id)
          console.log(articleId)
          Article.findOneAndUpdate({ "_id": req.params.id }, {$push: {'comment':doc._id}}, {new: true})
            // The Execution
            .exec(function(err, doc) {
                if (err) {
                    console.log(err);
                } else {
                    res.redirect('/readArticle/' + articleId);
                }
            });
        }
  });
});

module.exports = router;
