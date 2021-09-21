require("dotenv").config();
var mongoose = require('mongoose');
mongoose.connect(process.env.DB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var bcrypt = require('bcryptjs');
var nodemailer = require('nodemailer');
var ttl = require('mongoose-ttl');
const marked = require('marked');



/* ==CONNECTION TO THE DATABASE== */
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));



//Product schema & model
var productSchema = mongoose.Schema({
	name: String,
	description: String,
	price: Number,
	category: String,
	filenames: [String],
	tags: [String]
});
var Product = mongoose.model("Product", productSchema);


//Order schema & model
var orderSchema = mongoose.Schema({
	status: String,
	products: [{
		name: String,
		price: Number,
		id: String,
		quantity: Number
	}],
	totalSum: Number,
	phone: String,
	email: String,
	name: String,
	number: Number,
	expireAt: Date
});
var Order = mongoose.model("Order", orderSchema);
orderSchema.plugin(ttl, {ttl: 0});


//Meta schema & model (for storing server information, e.g. admin password, list of subscribed users, etc.)
var metaSchema = mongoose.Schema({
	numberOfOrders: Number,
	subscription: [{email: String, uniqueString: String}],
	password: String,
	expireTime: Number
});
var Meta = mongoose.model("Meta", metaSchema);


//Blog schema & model
var blogSchema = mongoose.Schema({
	title: String,
	body: String,
	preview: String,
	date: Date
});
var Blog = mongoose.model("Blog", blogSchema);



/* ==HELPER FUNCTIONS== */

//Sending an email using a gmail to a reciever, containing subject, text and html
function sendEmail(email, subject, text, html) {
	var Transport = nodemailer.createTransport({
		service: "gmail",
		auth: {
			user: "karimaltaybek@gmail.com",
			pass: "xsemldgrfczndfmo"
		}
	});
	
	var mailOptions;
	let sender = "Karim";
	mailOptions = {
		from: sender,
		to: email,
		subject: subject,
		text: text,
		html: html
	};
	
	Transport.sendMail(mailOptions);
}

//Generates a unique string for each user in the newsletter subscription list
function generate() {
	var result = '';
	var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for ( var i = 0; i < 15; i++ ) {
	   result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}

//Sends an email to every user in the newsletter subscription list
function newsletter(header, message) {
	Meta.findOne({}, async (err, response) => {
		if(err) console.log(err);
		else if(!response) console.log("No Meta found");
		else {
			for(var i = 0; i < response.subscription.length; i++) {
				sendEmail(response.subscription[i].email, header, "", message + `<br><a style="color:grey" href="http://localhost:3000/newsletter/unsubscribe/${response.subscription[i].uniqueString}">Отписаться</a></p>`);
			}
		}
	});
}

//Sorts a list by date
function sort(list, sortWay) {
	if(sortWay == 0) {
		list.sort(function(a, b) {
			return b.date - a.date;
		});
	} else {
		list.sort(function(a, b) {
			return a.date - b.date;
		});
	}
	
	return list;
}



const database = {
	//Creates a new product to the database
	createProduct: function createProduct(name, category, tags, description, price, files, callback) {
		var filenames = [];
		for(var i = 0; i < files.length; i++) {
			filenames[i] = files[i].filename;
		}
		var newProduct = new Product({
			name: name,
			category: category,
			tags: tags,
			description: description,
			price: price,
			filenames: filenames,
			numberOfPurchases: 0
		});
		
		newProduct.save((err, Product) => {
			if(err) callback(false, err);
			else {	
				callback(true, Product);
				newsletter("Новое поступление", `Здравствуйте!\nВ нашем онлайн-магазине Handmade Naziya появился ${Product.name}!`);
			}
		});
	},


	//Finds a product by id (for rendering a single product)
	findProductById: function findProductById(id, callback) {
		Product.findOne({_id: id}, (err, Product) => {
			if(err) callback(false, err);
			else if(!Product) callback(false, null);
			else callback(true, Product);
		});
	},


	//Find all products (for rendering multiple products)
	getProducts: async function getProducts(callback) {
		var wallets;
		var covers;
		Product.find({category: "wallet"}, (err, Products) => {
			if(err) callback(false, err, err);
			else if(!Products) callback(false, null, null);
			else {
				wallets = Products;
				Product.find({category: "cover"}, (err, Products) => {
					if(err) callback(false, err, err);
					else if(!Products) callback(false, null, null);
					else {
						covers = Products;
						callback(true, wallets, covers);	
					}
				});
			}
		});
	},


	//Finds all products in a specific category (for rendering multiple products)
	findProductsByCategory: function findProductsByCategory(category, callback) {
		Product.find({category: category}, (err, Products) => {
			if(err) callback(false, err);
			else if(!Products) callback(false, null);
			else callback(true, Products);
		});
	},


	//Creates a new Order and writes it to the database
	placeOrder: async function placeOrder(name, cart, email, phone, totalSum, callback) {
			var number = 0;
			await Meta.findOne({}, async (err, response) => {
				if(err) console.log(err);
				else if(!response) {
					newMeta = new Meta({
						numberOfOrders: 0,
						subscription: [],
						password: bcrypt.hashSync("@verySecure_Passw0rd", 10),
						expireTime: 7 * 24 * 60 * 60 * 1000
					});
					await newMeta.save((err, response) => {});
				}
				else {
					number = response.numberOfOrders;
					response.numberOfOrders++;
					await response.save((err, response) => {});
				}
			});
			
			var newOrder = new Order({
				status: "В ожидании",
				products: cart,
				email: email,
				phone: phone,
				totalSum: totalSum,
				name: name,
				number: number+1
			});
			
			await newOrder.save((err, Order) => {
				if(err) console.log(err);
				else if(!Order) console.log("No order created");
				else {
					sendEmail(email, "Заказ добавлен", "", `Здравствуйте ${Order.name}.<br>Ваш заказ был добавлен и в скором времени мы начнем работать над ним. Как только это случиться, мы пришлем вам письмо. Спасибо за покупку!`);
					return callback(true, Order);
				}
			});
	},


	//Removes a product (Admin only)
	removeProduct: function removeProduct(id, callback) {
		Product.deleteOne({_id: id}, (err, response) => {
			if(err) callback(false, err);
			else if(!response) callback(false, null);
			else callback(true, response);
		})
	},


	//Finds all orders (for rendering multiple orders)
	findOrders: function findOrders(callback) {
		Order.find({}, (err, response) => {
			if(err) callback(false, err);
			else if(!response) callback(false, null);
			else callback(true, response);
		});
	},

	//Finds an order by id (for rendering a single order)
	findOrderById: function findOrderById(id, callback) {
		Order.findOne({_id: id}, (err, response) => {
			if(err) callback(false, err);
			else if(!response) callback(false, null);
			else callback(true, response);
		});
	},


	//Confirms an order and sends an email to the user
	confirmOrder: function confirmOrder(id, callback) {
		Order.findOne({_id: id}, async (err, orderFound) => {
			if(err) callback(false, err);
			else if(!orderFound) callback(false, null);
			else {
				orderFound.status = "Подтвержден";
				await orderFound.save((err, response) => {
					if(err) callback(false, err);
					else if(!response) callback(false, null);
					else { 
						sendEmail(response.email, "Заказ подтвержден", "", `Здравствуйте ${response.name}.<br>Ваш заказ был принят и мы уже начали работать над ним. Мы пришлем вам письмо как только заказ будет формирован и отправлен. Спасибо за покупку!`);
						callback(true, orderFound);
					}
				});
			}
		});
	},


	//Finds products with filter (for rendering multiple products)
	/* = CURRENTLY NOT USED. UNDER DEVELOPMENT =*/
	findProductsWithFilter: function findProductsWithFilter(category, filter, callback) {
		Product.find({category: category}, (err, Products) => {
			if(err) callback(false, err);
			else if(!Products) callback(false, null);
			else {
				var finished = [];
				for(var i = 0; i < Products.length; i++) {
					for(var j = 0; j < filter.length; j++) {
						if(Products[i].tags.indexOf(filter[j]) > -1) {
							finished.push(Products[i]);
							break;
						}
					}
				}
				
				callback(true, finished);
			}
		});
	},


	//Searches products containing specific words (for rendering multiple products)
	findProducts: function findProducts(search, callback) {
		var result = [];
		
		var searchWords = search.split(" ");
		
		Product.find({}, (err, product) => {
			if(err) callback(false, err);
			else if(product) {
				for(var i = 0; i < searchWords.length; i++) {
					for(var j = 0; j < product.length; j++) {
						if(product[j].name.toLowerCase().match(searchWords[i].toLowerCase()) != null) result.push(product[j]);
					}
				}
				
				callback(true, result);
			};
		});
	},


	//Deletes an Order from the database and sends an email to the user
	deleteOrder: function deleteOrder(note, id, callback) {
		Meta.findOne({}, async (err, response) => {
			if(err) console.log(err);
			else if(!response) console.log("No meta found");
			else {
				Order.findOne({_id: id}, (err, order) => {
					if(err || !order) callback(false, err);
					else {
						if(order.status == "Отправлен") {
							order.status = "Архивирован";
							order.expireAt = Date.now() + response.expireTime;
							order.save({}, (err, res) => {
								if(err || !res) callback(false, err);
								else callback(true, res);
							});
						} else {
							order.status = "Отклонен";
							order.expireAt = Date.now() + response.expireTime;
							order.save({}, (err, res) => {
								if(err || !res) callback(false, err);
								else {
									if(note != "" && note) {
										sendEmail(order.email, "Заказ отклонен", "", `Здравствуйте ${order.name}.<br>Ваш заказ был отклонен производителями по причине: ${note}. Если вы заранее оплатили заказ или у вас возникли вопросы, вы можете <a href="localhost:3000/contact-us">написать нам</a>.`);
									} else {
										sendEmail(order.email, "Заказ отклонен", "", `Здравствуйте ${order.name}.<br>По какой-то причине ваш заказ был отклонен. Если вы заранее оплатили заказ или у вас возникли вопросы, вы можете <a href="localhost:3000/contact-us">написать нам</a>.`);
									}
									
									callback(true, res);
								}
							});
						}
					}
				});
			}
		});
	},


	//Adds user to the list of newsletter subscriptions
	subscribe: function subscribe(email, callback) {
		Meta.findOne({}, async (err, response) => {
			if(err) console.log(err);
			else if(!response) {
				newMeta = new Meta({
					numberOfOrders: 0,
					subscription: [{email: email, uniqueString: generate()}],
					password: bcrypt.hashSync("@verySecure_Passw0rd", 10),
					expireTime: 7 * 24 * 60 * 60 * 1000
				});
				await newMeta.save((err, response) => {});
				callback(true, response);
			}
			else {
				for(var i = 0; i < response.subscription.length; i++) {
					if(response.subscription[i].email == email) callback(false, false);
				}
				response.subscription.push({email: email, uniqueString: generate()});
				await response.save((err, response) => {});
				callback(true, response);
			}
		});
	},


	//Removes user from the list of newsletter subscriptions
	unsubscribe: function unsubscribe(id, callback) {
		Meta.findOne({}, async (err, response) => {
			if(err) console.log(err);
			else if(!response) console.log("No meta found");
			else {
				for(var i = 0; i < response.subscription.length; i++) {
					if(response.subscription[i].uniqueString == id) {
						response.subscription.splice(i, 1);
						callback(true, response);
					}
				}
			}
		});
	},


	//Changes Order's status to 'Sent' and sends an email to the user
	sendOrder: function sendOrder(id, callback) {
		Order.findOne({_id: id}, async (err, orderFound) => {
			if(err) callback(false, err);
			else if(!orderFound) callback(false, null);
			else {
				orderFound.status = "Отправлен";
				await orderFound.save((err, response) => {
					if(err) callback(false, err);
					else if(!response) callback(false, null);
					else { 
						sendEmail(response.email, "Заказ отправлен", "", `Здравствуйте ${response.name}.<br>Ваш заказ был сформирован и отправлен. В скорем времени он должен вам прийти. Спасибо за покупку!`);
						callback(true, orderFound);
					}
				});
			}
		});
	},


	//Edits a product
	editProduct: function editProduct(id, title, description, callback) {
		Product.findOne({_id: id}, (err, product) => {
			console.log(id, product);
			if(err) callback(false, err);
			else if(!product) callback(false, null);
			else {
				console.log(title, description);
			
				product["name"] = title;
				product["description"] = description;
				
				console.log(product);
				
				product.save({}, (err, response) => {
					if(err) callback(false, err);
					else if(!response) callback(false, null);
					else callback(true, response);
				});
			}
		});
	},


	//Gets all blogs and sorts them
	getBlogs: function getBlogs(callback, sortWay) {
		Blog.find({}, (err, response) => {
			if(err || !response) callback(false, err);
			else {
				//Sorts the returned blogs before passing them to callback
				callback(true, sort(response, sortWay || 0));
			}
		});
	},


	//Gets a blog
	getBlog: function getBlog(id, callback) {
		Blog.findOne({_id: id}, (err, response) => {
			if(err || !response) callback(false, err);
			else {
				callback(true, response);
			}
		});
	},


	//Compares an entered and an encrypted password (Admin only)
	comparePassword: function comparePassword(password, callback) {
		Meta.findOne({}, async (err, response) => {
			if(err) console.log(err);
			else if(!response) callback(null);
			else {
				callback(bcrypt.compareSync(password, response.password));
			}
		});
	},


	//Changes administrator's password
	changePassword: function changePassword(newPassword, callback) {
		Meta.findOne({}, async (err, response) => {
			if(err) console.log(err);
			else if(!response) callback(false, null);
			else {
				response.password = bcrypt.hashSync(newPassword, 10);
				response.save((err, response) => {});
				callback(true, response);
			}
		});
	},


	//Writes a new blog to the database
	blogAdd: function blogAdd(title, body, preview, callback) {		
		var newBlog = new Blog({
			title: title,
			body: marked(body),
			preview: preview,
			date: Date.now()
		});
		
		newBlog.save({}, (err, res) => {
			if(err || !res) callback(false, err);
			else {
				callback(true, res);
				newsletter("Новая запись в блоге", `Здравствуйте!\nВ нашем блоге Handmade Naziya появилась новая запись! <a href=\"http://localhost:300/blog/${res._id}\">${Product.name}!`);
			}
		});
	}
}

module.exports = database;
