var previous;
var next;
var search;
var close;
var mobileNav;
var messageClose;

document.addEventListener('DOMContentLoaded', () => {
	

	var images = document.getElementsByClassName("product-image");
	var current = 0;
	var searchForm = document.getElementById("search-form");
	var searchElem = document.getElementById("search");
	var opened = false;
	var hidden = false;

	previous = function() {
		images[current].classList.add("hidden");
	
		current--;
		if(current < 0) current = images.length-1;
	
		images[current].classList.remove("hidden");
	}
	
	next = function() {
		images[current].classList.add("hidden");
	
		current++;
		if(current > images.length-1) current = 0;
	
		images[current].classList.remove("hidden");
	}
	
	search = function() {
		searchElem.classList.add("hidden");
		searchForm.style.display = "initial";
		searchForm.style.zIndex = "8";
		document.getElementById("searchInput").disabled = false;
	}
	
	close = function() {
		searchElem.classList.remove("hidden");
		searchForm.style.display = "none";
		searchForm.style.zIndex = "-4";
		document.getElementById("searchInput").disabled = true;
	}
	
	mobileNav = function() {
		if(opened) {
			document.getElementById("nav-holder").style.display = "none";
			document.getElementById("nav-holder").style.width = "0vw";
		} else {
			document.getElementById("nav-holder").style.display = "flex";
			document.getElementById("nav-holder").style.width = "70vw";
		}
		
		opened = !opened;
	}
	
	messageClose = function() {
		document.getElementById("message").style.display = "none";
	}
	
	document.getElementById("close").addEventListener('click', close);
});
