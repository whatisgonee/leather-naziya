require("dotenv").config();
var express = require('express');
var router = express.Router();
var database = require('./database.js');
var bcrypt = require('bcryptjs');
var multer = require('multer');
const path = require('path');
var validator = require('validator');



const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/media');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}

const upload = multer({ storage: storage, fileFilter: fileFilter });



/*  HOME SECTION  */

//Main page of the website
/*
Shows five products (or less) from wallets and covers category
*/
router.get("/", async (req, res) => {
	const finishUp = function(result, wallets, covers) {
		if(!result) res.send("Что-то пошло не так");
		else {
			message = req.session.message;
			req.session.message = null;
			res.render("home", {user: req.session.user, wallets: wallets, covers: covers, message: message});
		}
	}
	await database.getProducts(finishUp);
});


//About us page of the website
/*
Shows a quick description of the online shop, can include a few images
*/
router.get("/about-us", (req, res) => {
	res.render("about-us");
});


//Contact us page
/*
Shows ways to contact the owners
*/
router.get("/contact-us", (req, res) => {
	res.render("contactUs");
})


//Newsletter functionality
/*
Takes user's email and puts it into the database. Sends letters when a new product or blog post is created. Can be adjusted through admin panel
*/
router.post("/newsletter", async (req, res) => {
	const finishUp = function(result, response) {
		if(!result && !response) res.render("displayMessage", {titleTop: "Готово!", section: "", message: "Вы уже подписаны на новостную рассылку", topMessage: "Подписка"});
		else if(!result) res.send("Что-то пошло не так");
		else res.render("displayMessage", {titleTop: "Готово!", section: "", message: "Вы успешно подписались на новостную рассылку", topMessage: "Подписка", backLink: req.headers.referer});
	}
	await database.subscribe(req.body.email, finishUp);
});


//Newsletter unsubscription functionality
/*
Takes unique string that is assigned to every user that is subscribed to newsletter and unsubscribes them. Can be accessed through every email that is sent by the newsletter
*/
router.get("/newsletter/unsubscribe/:uniqueString", async (req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send("Что-то пошло не так");
		else res.render("displayMessage", {titleTop: "Готово!", section: "", message: "Вы успешно отписались от новостной рассылки", topMessage: "Отписка", backLink: "/"});
	}
	await database.unsubscribe(req.params.uniqueString, finishUp);
});


//Blog page
/*
Shows recent blogs to user
*/
router.get("/blog", async (req, res) => {
	const finishUp = function(result, response) {
		if(!result || !response) res.send("Что-то пошло не так");
		else res.render("blog", {blogs: blogParse(response)});
	}

	await database.getBlogs(finishUp);
});



//Singular blog page
/*
Shows a certain blog to user
*/
router.get("/blog/:id", async (req, res) => {
	const finishUp = function(result, response) {
		if(!result || !response) res.send("Что-то пошло не так");
		else res.render("blogOne", {blog: blogParse(response)});
	}
	
	await database.getBlog(req.params.id, finishUp);
});



/*  SHOPPING SECTION  */

//User's shopping cart
/*
Shows a list of products that are in the shopping cart, it's total sum and a Buy button. Products's quanitity can be increased or removed from the cart.
*/
router.get("/cart", async (req, res) => {
	if(req.session.cart) {
		res.render("cart", {products: req.session.cart, sum: count(req.session.cart)});
	} else {
		res.render("cart", {products: [], sum: 0});
	}
});



//Shop page
/*
Shows every product that are registered in the database.
*/
router.get("/collections/all/", async (req, res) => {
	const finishUp = function(result, response) {
		if(result && response) res.render("wallets", {user: req.session.user, wallets: response});
		else if(!result) res.send("Что-то пошло не так");
	}
	
	if(req.query["filter"]) {
		await database.findProductsWithFilter(req.query.category, req.query.filter, finishUp)
	} else {
		await database.findProductsByCategory(req.query.category, finishUp);
	}
});



//Cart/buy functionality
/*
Product page contains two buttons for either putting the product to the shopping cart or buying it directly. This page decides whether the user clicked on the first or second button
*/
router.post("/collections/product", async (req, res) => {
	const finishUp = function(result, response) {
		if(result && response) {
			if(req.body.action == "Купить") {
				req.session.cart = [];
				addProductToSession(response, req, res, "/checkout");
			}
			else addProductToSession(response, req, res, "/cart");
		} else res.send("Что-то пошло не так");
	}
	
	await database.findProductById(req.body.id, finishUp);
});



//Product page
/*
Shows a product, including images and its description. Contains two buttons for either putting the product into the shopping cart or buying it directly.
*/
router.get("/collections/:category/:id", async (req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send("Что-то пошло не так" + response);
		else {
			message = req.session.message;
			req.session.message = null;
			response = productParse(response);
			res.render("product", {user: req.session.user, product: response, message: message});
		}
	}
	await database.findProductById(req.params.id, finishUp);
});


//Search results
/*
Shows results of a search. Search can be accessed on every page at the top or at the bottom of the page
*/
router.get("/collections/search", async (req, res) => {
	await database.findProducts(req.query.search, (result, response) => {
		message = req.session.message;
		req.session.message = null;
		res.render("collectionsProducts", {products: response, collection: "Поиск", message: message})
	});
});


//Shop (certain collection) page
/*
Shows products from a certain collecion (wallets or covers). It can be accessed through the Collections page.
*/
router.get("/collections/:category", async (req, res) => {
	const finishUp = function(result, response) {
		if(!result || !response) res.send("Что-то пошло не так");
		else {
			message = req.session.message;
			req.session.message = null;
			res.render("collectionsProducts", {products: response, collection: req.params.category, message: message});
		}
	}

	if(req.params.category == "all") await database.findProductsByCategory("", finishUp);
	else await database.findProductsByCategory(req.params.category, finishUp);
});



//Shopping cart functionality
/*
Puts a certain product into the shopping cart, and then redirects the user back to the previous page.
*/
router.post("/cart/add", async (req, res) => {
	const finishUp = function(result, response) {
		if(result && response) {
			addProductToSession(response, req, res, req.body.referer);
		}
		else if(!result) res.send("Что-то пошло не так");
	}
	
	await database.findProductById(req.body.id, finishUp);
});



//Checkout form page
/*
A form that a user must fill before buying all the products in the shopping cart. Requires name, email, phone and additionaly a note. It automatically saves the information on the first entry for convinience.
*/
router.get("/checkout", checkCartSession, (req, res) => {
	res.render("checkout", {user: req.session.user, totalSum: count(req.session.cart)});
});



//Checkout functionality
/*
Makes a new Order in the database, clears the contents of the cart and informs a user if the operation has been successful.
*/
router.post("/checkout", checkCartSession, async (req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send("Что-то пошло не так");
		else res.render("displayMessage", {titleTop: "Готово!", section: "", message: "Ваш заказ создан!", topMessage: "Готово", backLink: "/"});
	}
	
	if(!validator.isMobilePhone(req.body.phone)) res.render("checkout", {formMessage: "Неверный номер телефона"});
	else {
		req.session.user = {name: req.body.name, phone: req.body.phone, email: req.body.email};
		database.placeOrder(req.body.name, req.session.cart, req.body.email, req.body.phone, count(req.session.cart), finishUp);
		req.session.cart = [];
	}
});



//Collections page
/*
Page containing collections that are stored in the database (wallets and covers).
*/
router.get("/collections", async (req, res) => {
	const finishUp = function(result, wallets, covers) {
		if(!result || !wallets || !covers) res.send("Что-то пошло не так");
		else {
			var previews = [wallets[0].filenames[0]];
			
			res.render("collections", {previews: previews});
		}
	}
	
	await database.getProducts(finishUp);
});



/*  ADMIN SECTION  */


//Admin password form
/*
A form for a new admin password, requires to enter and repeat a new password, and then re-log to access the admin panel
*/
router.get("/admin/password", adminCheck, async(req, res) => {
	res.render("passwordChange");
});

router.get("/admin/settings", adminCheck, async(req, res) => {
	res.render("settings");
});



//Admin expiration time setting
router.get("/admin/settings/expiration", adminCheck, (req, res) => {
	res.render("expiration");
});



//Admin expiration time functionality
router.post("/admin/settings/expiration", adminCheck, async(req, res) => {
	const finishUp = function(result, response) {

	}

	await database.expirationTime(req.body.expirationTime);
});



//Admin password functionality
/*
Encrypts and saves a new password into the database and then redirects to log in page if the operation has been successful (administrators have to re-enter the password for security measures)
*/
router.post("/admin/password", adminCheck, async(req, res) => {
	const finishUp = function(result, response) {
		if(!result || !response) res.send("Что-то пошло не так");
		else {
			res.render("adminLogin", {formMessage: "Вам необходимо ввести новый пароль", referer: "/admin"});
		}
	}

	if(req.body.newPassword.length < 8 || !/[!@#$%^&*](.*)\w(.*)[0-9](.*)/.test(req.body.newPassword) || /\s/.test(req.body.newPassword)) res.render("passwordChange", {message: "Пароль должен содержать не менее 8 знаков, один специальный знак (!@#$%^&*) и одну заглавную букву. Пароль НЕ должен содержать пробел"});
	else if(req.body.newPassword == req.body.passwordRepeat) await database.changePassword(req.body.newPassword, finishUp)
	else res.render("passwordChange", {message: "Пароли не совпадают"});
});



//Admin panel page
/*
The main admin panel which includes buttons to create a new product or blog post, see all user orders and accept/send/delete them, see all products and edit/delete them and settings
*/
router.get("/admin", adminCheck, (req, res) => {
	res.render("admin");
});



//New product form
/*
A form for creating a new product which requires a name, category, tags (additionaly), description, price and images
*/
router.get("/admin/products/add", adminCheck, (req, res) => {
	res.render("add");
});



//New product functionality
/*
Creates and saves a new product to the database
*/
router.post("/admin/products/add", [upload.array("file"), adminCheck], async (req, res) => {
	const finishUp = function(result, response) {
		if(!result) {
			res.send("Что-то пошло не так");
		} else {
			res.render("displayMessage", {section: "", titleTop:"Товар создан", topMessage: "Успех", message: "Товар успешно создан", backLink: req.headers.referer});
		}
	}
	
	await database.createProduct(req.body.name, req.body.category, req.body.tags.split(" "), req.body.description, req.body.price, req.files, finishUp);
});



//Products page
/*
Shows a list of products with buttons to delete or edit them.
*/
router.get("/admin/products/", adminCheck, async (req, res) => {
	const finishUp = function(result, wallets, covers) {
		if(!result || !wallets || !covers) res.render("Что-то пошло не так");
		else res.render("products", {products: wallets.concat(covers)});
	}
	
	await database.getProducts(finishUp);
});



//Delete product functionality
/*
Deletes a product from the database
*/
router.post("/admin/products/remove", adminCheck, async (req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send(response);
		else res.render("displayMessage", {section: "", titleTop:"Товар удален", topMessage: "Успех", message: "Товар успешно удален", backLink: req.headers.referer});
	}
	await database.removeProduct(req.body.id, finishUp);
});



//Admin login form
/*
A form which requires to enter an admin password. Redirects to admin or to the page which was passed through query
*/
router.get("/admin/login", (req, res) => {
	console.log(req.query.redirect);
	if(req.query.redirect) res.render("adminLogin", {referer: "/"+req.query.redirect.replace(" ", "/")});
	else res.render("adminLogin", {referer: "/admin"})
});



//Admin logout functionality
/*
Logs out the administrator by deleting current session.
*/
router.get("/admin/logout", adminCheck, (req, res) => {
	req.session.destroy();
	res.redirect("/admin/login");
});



//Admin login functionality
/*
Decrypts and compares two passwords from user entry and from the database. If password match, grants access to the admin panel and saves permission to session
*/
router.post("/admin/login", async (req, res) => {
	const finishUp = function(response) {
		if(response) {
			req.session.isAdmin = true;
			res.redirect(req.body.referer);
		} else res.render("adminLogin", {message: "Неверный пароль"});
	}
	
	await database.comparePassword(req.body.password, finishUp);
});


//Orders page
/*
Shows a list of all orders with the ability to confirm/send/delete (reject) them. Has a list of archived orders (those which were fulfilled and sent) at the bottom
*/
router.get("/admin/orders", adminCheck, async (req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send(response);
		else res.render("orders", {orders: response});
	}
	await database.findOrders(finishUp);
});


//Product edit form
/*
A form for editing an existing product. Title, tags and description can be changed.
*/
router.get("/admin/products/edit", adminCheck, async (req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send("Что-то пошло не так" + response);
		else {
			response = productParse(response);
			res.render("productEdit", {product: response});
		}
	}
	await database.findProductById(req.query.id, finishUp);
});


//Product edit functionality
/*
Passes product's id, title, tags and description and updates it in the database, then notifies the administrator if the operation was successful
*/
router.post("/admin/products/edit", adminCheck, async (req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send("Что-то пошло не так" + response);
		else {
			response = productParse(response);
			res.render("productEdit", {product: response, message: "Товар обновлен. "});
		}
	}
	await database.editProduct(req.body.id, req.body.title, req.body.description, finishUp);
});


//Confirmation functionality
/*
Changes order's status to "confirmed" and informs an administrator and the user that an order has been confirmed (i.e. the order was accepted and is currenty being fulfilled)
*/
router.get("/admin/orders/confirm", adminCheck, async(req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send(response);
		else res.render("displayMessage", {section: "", titleTop:"Заказ подтвержден", topMessage: "Подтверждение", message: "Заказ был подтвержден. Мы уже отправили письмо клиенту об этой новости.", backLink: req.headers.referer});
	}
	
	await database.confirmOrder(req.query.id, finishUp);
});


//Send functionality
/*
Changes order's status to "sent" and informs an administrator and the user that an order has been sent (i.e. the order was fulfilled and send to the user by post)
*/
router.get("/admin/orders/send", adminCheck, async(req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send(response);
		else res.render("displayMessage", {section: "", titleTop:"Заказ отправлен", topMessage: "Отправление", message: "Заказ был отправлен. Мы уже прислали письмо клиенту об этой новости.", backLink: req.headers.referer});
	}
	
	await database.sendOrder(req.query.id, finishUp);
});


//Delete (reject) page
/*
Deletes an order and informs an administrator and the user that an order has been rejected (i.e. the order cannot be fulfilled for a certain reason) 
*/
router.get("/admin/orders/delete", adminCheck, async(req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send(response);
		else res.render("displayMessage", {titleTop: "Заказ отклонен", section: "", topMessage: "Отклонение", message:"Заказ был отклонен. Мы уже отправили письмо клиенту об этой новости.", backLink: req.headers.referer});
	}
	await database.deleteOrder(req.query.note, req.query.id, finishUp);
});


//Confirmation page
/*
Asks and administrator if they truly want to confirm/send/delete an order, since this action cannot be reversed
*/
router.get("/admin/confirmation/:type", adminCheck, async(req, res) => {
	res.render("confirmation", {type: req.params.type, id: req.query.id});
});



//Order page
/*
Shows order's information, its id, status, user's name, email and phone, and the requested products. Contains buttons to confirm/send/delete an order. 
*/
router.get("/admin/orders/:id", adminCheck, async(req, res) => {
	const finishUp = function(result, response) {
		if(!result) res.send(response);
		else res.render("order", {order: response});
	}
	
	await database.findOrderById(req.params.id, finishUp);
});



//Blogs page
/*
Shows all exisisting blogs
*/
router.get("/admin/blog/", adminCheck, async(req, res) => {
	const finishUp = function(result, response) {
		if(!result || !response) res.send(response);
		else res.render("blog", {blogs: blogParse(response), role: "admin"});
	}

	await database.getBlogs(finishUp);
});



//Add new blog form page
/*
A form for creating new blog. Title, body and preview (optional) can be added.
*/
router.get("/admin/blog/add", adminCheck, (req, res) => {
	res.render("blogForm");
});



//Add new blog functionality
/*
Takes title, body and preview (optional) and creates a new blog
*/
router.post("/admin/blog/add", adminCheck, async(req, res) => {
	const finishUp = function(result, response) {
		if(!result || !response) res.send("Что-то пошло не так");
		else res.render("displayMessage", {titleTop: "Успех", section: "", topMessage: "Успех", message: "Новая запись в блоге создана", backLink: "/admin/blog"});
	}
	await database.blogAdd(req.body.name, req.body.short, req.body.blog, req.file, finishUp);
});



//For wrong URLs
/*
404 page
*/
router.get("*", (req, res) => {
	res.render("displayMessage", {titleTop:"404", section: "", topMessage: "Ошибка", message: "Ошибка 404: Страница не найдена", backLink: req.headers.referer});
});


//Checks whether a user is logged as an administrator
function adminCheck(req, res, next) {
	if(req.session.isAdmin) next();
	else {
		res.redirect("/admin/login?redirect="+redirectParse(req.originalUrl));
	}	
}


//Parses original url to url friendly
function redirectParse(url) {
	return url.substring(1, url.length).replace("/", "+");
}


//Parses a product for display
function productParse(product) {
	var finished = product;
	if(product.category == "wallet") finished.category = "кошельки";
	else finished.category = "обложки";
	
	finished.tag = "";
	
	for(var i = 0; i < product.tags.length; i++) {
		if(i == product.tags.length - 1) finished.tag += product.tags[i];
		else finished.tag += product.tags[i] + ", ";
	}
	
	return finished;
}



//Counts the total sum of user's cart
function count(products) {
	var total = 0;
	for(var i = 0; i < products.length; i++) {
		total += products[i].price * products[i].quantity;
	}
	
	return total;
}



//Adds product to cart or creates one
function addProductToSession(response, req, res, redirect) {
	product = {
		name: response.name,
		description: response.description,
		filenames: response.filenames,
		id: response._id,
		quantity: parseInt(req.body.quantity),
		price: response.price,
		preview: response.filenames[0]
	}
	req.session.message = "Товар добавлен в ";
	if(req.session.cart) {
		for(var i = 0; i < req.session.cart.length; i++) {
			if(req.session.cart[i].id == product.id) {
				if(product.quantity <= 0) {
					req.session.cart.splice(i, 1);
					return res.redirect(redirect);
				}
				else {
					req.session.cart[i].quantity = product.quantity;
					return res.redirect(redirect);
				}
			}
		}
		req.session.cart.push(product);
		return res.redirect(redirect);
	} else {
		req.session.cart = [];
		req.session.cart.push(product);
		return res.redirect(redirect);
	}
}


//Checks if the user has a shopping cart
function checkCartSession(req, res, next) {
	if(req.session.cart) next();
	else res.redirect("/cart");
}


//Parses the blog
function blogParse(blogs) {
	let result = blogs;
	if(blogs.constructor === Array) {
		for(let i = 0; i < result.length; i++) {
			let parsedBody = blogs[i].body.match(/<(.*)>(.*)<\/(.*)/g) || blogs[i].body;
			result[i].body = reconstructBody(parsedBody);
			result[i].parsedDate = dateParse(blogs[i].date);
		}
		
		return result;
	} else {
		result.parsedDate = dateParse(blogs.date);
		return result;
	}
}


//Reconstructs the body of blog 
function reconstructBody(body) {
	let result = "";
	for(let i = 0; i < body.length; i++) {
		let matched = body[i].match(/<(.*)>(.*)<\/(.*)/);
		if(matched) result += "\n\r" + matched[2];
		else result += body[i];
	}
	return result;
}

function dateParse(date) {
	var seconds = Math.round((Date.now() - date) / 1000);
	var minutes = Math.round(seconds / 60);
	var hours = Math.round(minutes / 60);
	var days = Math.round(hours / 24);
	
	if(seconds > 0 && seconds < 60) {
		switch(seconds) {
			case 1:
				return 'Только что';
			case 21:
			case 31:
			case 41:
			case 51:
				return seconds + ' секунду назад';
			case 2:
			case 22:
			case 32:
			case 42:
			case 52:
			case 3:
			case 23:
			case 33:
			case 43:
			case 53:
			case 4:
			case 24:
			case 34:
			case 44:
			case 54:
				return minutes + ' секунды назад';
			default:
				return minutes + ' секунд назад'
		}
	}
	else if(minutes > 0 && minutes < 60) {
		switch(minutes) {
			case 1:
			case 21:
			case 31:
			case 41:
			case 51:
				return minutes + ' минуту назад';
			case 2:
			case 22:
			case 32:
			case 42:
			case 52:
			case 3:
			case 23:
			case 33:
			case 43:
			case 53:
			case 4:
			case 24:
			case 34:
			case 44:
			case 54:
				return minutes + ' минуты назад';
			default:
				return minutes + ' минут назад'
		}
	}
	else if(hours > 0 && hours < 24) {
		switch(hours) {
			case 1:
			case 21:
				return '1 час назад';
			case 2:
			case 22:
			case 3:
			case 23:
			case 4:
				return hours + ' часа назад';
			default:
				return hours + ' часов назад';
		}
	}
	else if(days > 0 && days < 7) {
		switch(days) {
			case 1:
				return '1 день назад';
			case 2:
			case 3:
			case 4:
				return days + ' дня назад';
			default:
				return days + ' дней назад';
		}
	} else if(days > 7 && days < 28) {
		switch(days) {
			case 7:
			case 8:
			case 9:
			case 10:
			case 11:
			case 12:
			case 13:
				return 'Неделю назад';
			case 14:
			case 15:
			case 16:
			case 17:
			case 18:
			case 19:
			case 20:
				return '2 недели назад';
			default:
				return '3 недели назад';
		}
	} else if(days > 28 && days < 365) {
		switch(Math.round(days / 28)) {
			case 1:
				return 'Месяц назад';
			case 2:
			case 3:
			case 4:
				return Math.round(days / 28) + ' месяца назад';
			default:
				return Math.round(days / 28) + ' месяцев назад';
		}
	} else {
		return date.getDate() + '.' + date.getMonth() + '.' + date.getFullYear();
	}
}
module.exports = router;
