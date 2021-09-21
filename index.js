require("dotenv").config();
var express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer');
var app = express();
var cookieParser = require('cookie-parser');
var session = require('express-session');
const path = require('path');

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

app.set('view engine', 'pug');
app.set('views', './views');
app.use("/public", express.static(path.join(__dirname,'/public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(cookieParser());
app.use(session({
	secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
}));

var routes = require('./routes.js');

app.use("/", routes);

function adminCheck(req, res, next) {
	if(req.session.user) {
		if(req.session.user.role == "admin") next();
		else res.send("Недостаточно прав.");	
	} else {
		res.redirect("/signup")
	}
}

app.listen(process.env.PORT || 3000, () => {
	console.log("App is launched");
});
