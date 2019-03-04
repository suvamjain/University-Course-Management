var express = require("express"); 
var moment = require("moment");
var methodOverride = require('method-override');
var app = express();

app.use(express.urlencoded({extended: true}));
// override with POST having ?_method=DELETE
app.use(methodOverride('_method'));
// app.use(express.bodyParser());
app.set('views', './views');
app.set('view engine', 'pug');

/*
    All variables are defined below which are used for 
    - storing registered users
    - storing current loggedIn user Index
    - storing all courses available
    - storing all the searched courses
    - storing user's registered courses
*/

var registeredUsers = [];
var mycourses=[];
var searchCourses=[];
var courses = {};
var currUserIndex = -1;
const timeFormat = 'YYYY-MM-DD h:mm a';

//Admin is already a registered user.
registeredUsers.push({
    usr: "admin", 
    pwd: "admin",
    myCrs: [],
    loggedIn: false
});

//Adding two sample courses for reference
var st = moment().add(5, "minutes").format(timeFormat);
courses['C101'] = {
    course: 'Sample Course 1',
    dur: st,
    status: 'Registrations Open',
    stud: 0
};
courses['C102'] = {
    course: 'Sample Course 2',
    dur: st,
    status: 'Registrations Open',
    stud: 0
};

//Middleware used to handle PUT update requests for modification of course by admin
app.use(methodOverride(function (req, res) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      // look in urlencoded POST bodies and delete it
      var method = req.body._method;
      delete req.body._method;
      return method;
    }
}));

//Middleware used to handle certain requests based on loggedIn users
app.use((req, res, next)=> {
    console.log("middleware says URL: ",req.url);
    if(req.url === '/')
        return next();

    // if user is authenticated in the session, carry on
    if (currUserIndex > -1 && registeredUsers[currUserIndex].loggedIn) {
        if (req.url === '/auth' || req.url === '/signIn' || req.url === '/signUp' || req.url === '/register') {
            return res.render("auth_error", {backUrl: "/home/" + currUserIndex, errmsg:"Unauthorized access, Already Logged in as another User"});
        }
        updateCoursesStatus(courses); 
        next();  
    }
    // if they aren't logged in 
    else {
        //And they are not on any of these pages then redirect them to the login page
        if(req.url !== '/auth' && req.url !== '/signIn' && req.url !== '/signUp' && req.url !== '/register') 
            res.render("auth_error", {backUrl: "/auth", errmsg:"Unauthorized access"});
        next();
    }
});


/*
    User Authentication handlers are defined below - 
        - authentication,
        - sign In,
        - signUp,
        - register a user,
        - logout
*/

app.get("/",(req,res)=> {
    if(currUserIndex > -1) 
        res.redirect("/home/"+currUserIndex);
    else 
        res.redirect("/auth");
});

app.get("/auth", (req,res) => {
    res.render("auth", {data: {}, errmsg: null}); 
    if (currUserIndex >-1 && registeredUsers[currUserIndex].usr)
        console.log("Active users -->" + registeredUsers[currUserIndex].usr);
    else    
        console.log("Active users --> No users are active");
    console.log("Registered users -->" + JSON.stringify(registeredUsers));
});

app.post("/auth", (req,res) => {
    res.redirect("/auth"); 
});

app.get("/signIn", (req,res) => {
    if (currUserIndex > -1)
        res.redirect("/");
    else
        res.render("auth", {data: {}, errmsg: null}); 
});

app.post("/signIn", (req,res) => {
    //check if all fields are filled
    if(req.body.usr == '' || req.body.pwd == '') {
        res.render("auth", {data: req.body, errmsg: "Please fill all the fields !!!"});
    }
    else {
        //check if user already registered or not
        var usrExist = registeredUsers.find(function(u,i) {
            if(u.usr === req.body.usr && u.pwd === req.body.pwd) {
                currUserIndex = i;
                return true;
            }
        });
        if(usrExist) {
            //registered so go to home page and add user to active users list (if not already added)
            registeredUsers[currUserIndex].loggedIn = true;
            mycourses = registeredUsers[currUserIndex].myCrs;
            res.redirect("/home/"+ currUserIndex);
        }
        else {
            //user not registered so, show err msg
            res.render("auth", {data: req.body, errmsg: "Incorrect Username or Password. Please try again or Sign Up"});
        }
    }
});

app.get("/signUp", (req,res) => {
    res.render("register", {data:{}, errmsg:null});
});

app.post("/signUp", (req,res) => {
    res.render("register", {data:{}, errmsg:null});
});

app.post("/register", (req, res) => {
    var body = req.body;
    //check if all fields are filled
    if(body.usr == '' || body.pwd == '' || body.cpwd == '') {
        res.render("register", {data: body, errmsg: "Please fill all the fields !!!"});
        return;
    } 

    //check password & confirm password is same
    else if (body.pwd != body.cpwd) {
        res.render("register", {data: body, errmsg:"Password and Confirm Password do not match"});
        return;
    }

    //check whether this user already exists
    else if (registeredUsers.find(u => u.usr === body.usr)) {
        res.render("register", {data: body, errmsg: "Username already exists, please try some other name"});
        return;
    } 
    let us = {usr: body.usr, pwd: body.pwd, myCrs: [], loggedIn: true}
    registeredUsers.push(us); //add to all registered users list
    currUserIndex = registeredUsers.indexOf(us);
    res.redirect("/home/"+currUserIndex); //all good send user to home page
});

app.post("/logout", (req,res) => {
    registeredUsers[currUserIndex].loggedIn = false;
    mycourses = [];
    currUserIndex = -1;
    res.redirect("/auth");
});


/*
    Course Management handlers are defined below -
        - adding a new course,
        - enrolling/unenrolling for a new course, 
        - viewing a course details,
        - checking course started or not, 
        - updating course details
        - searching course by code or title
        - viewing all my registered courses and their status
*/

//get method to go or redirect to home by passing the userIndex
app.get("/home/:uid", (req,res) => {

    console.log("Registered users -->" + JSON.stringify(registeredUsers));

    //check user is logged in or not by checking the element at uid pos in registeredUsers[] is there in users[] or not
    if(req.params.uid != -1 && currUserIndex == req.params.uid && registeredUsers[req.params.uid].loggedIn === true) {
        res.render("home",{userName: registeredUsers[req.params.uid].usr});
    }
    else {
        res.render("auth_error", {backUrl: "/home/"+currUserIndex, errmsg:"Unauthorized access, Already Logged in as another User"});
    }
});

app.post("/home/:uid", (req,res) => {
    res.redirect("/home/" + req.params.uid);
})

app.post("/addCourse", (req,res) => {
    if(req.body.course==undefined || req.body.code==undefined) {
        res.render("course", {data: req.body, isAddCourse: true, homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
    }
    else {
        if(req.body.course=='' || req.body.code=='' || req.body.dur=='') 
            res.render("course", {data: req.body, isAddCourse: true, homeUrl: "/home/"+currUserIndex, 
                                coursesList: JSON.stringify(courses), errmsg: "Please fill all the fields !!!"});
        else {
            if(courses[req.body.code] !== undefined) {
                res.render("course", {data: req.body, isAddCourse: true, homeUrl: "/home/"+currUserIndex,
                                 coursesList: JSON.stringify(courses), errmsg: "Course with this name or code already exists !!!"});
            }
            else {
                //add new course to courses-array
                var et = moment().add(req.body.dur, "minutes").format(timeFormat);
                let a = {
                    course: req.body.course,
                    dur: et,
                    status: 'Registrations Open',
                    stud: 0
                };
                courses[req.body.code] = a;
                updateCoursesStatus(courses);
                res.render("course", {data: {}, isAddCourse: true, homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
            }
        }
    }
});

app.get('/addCourse', function(req, res) {
    if(registeredUsers[currUserIndex].usr ==='admin')
        res.render("course", {data: {}, isAddCourse: true, homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
    else 
        res.redirect("/unknown");
});

app.post("/myCourseList", (req,res) => {
    res.render("course", {data: req.body, isShowMyCrs: true, myList: JSON.stringify(mycourses), homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
});

app.post("/registerCourse", (req,res) => {
    res.render("course", {data: {}, isRegistration: true, myList: JSON.stringify(mycourses), homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
});

app.post("/enrollCourse", (req,res) => {
    let enrollcrs = req.body.mycrscode;
    var found  = false;
    if (courses[enrollcrs] !== undefined)
        found = true;
    else    
        found = false;

    //check if course exists and still not blocked for enrollment
    if(found && isRegistrationGoingOn(moment(courses[enrollcrs].dur,timeFormat), moment())) {
        if(mycourses.find(item => item === enrollcrs)) {
            //if already enrolled update the counter and remove course from myarray
            courses[enrollcrs].stud -=1;
            mycourses = mycourses.filter(item => item !== enrollcrs)
        }
        else {
            //if not already enrolled then inc counter and add course to myaaray
            courses[enrollcrs].stud +=1;
            mycourses.push(enrollcrs);
        }

        //update user's registered courses
        registeredUsers[currUserIndex].myCrs = mycourses; 

        console.log("After enrolling",registeredUsers[currUserIndex]);

        res.render("course", {data: {}, isRegistration: true,
            myList: JSON.stringify(mycourses), homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
    }
    else {
        res.render("course", {data: {}, isRegistration: true, myList: JSON.stringify(mycourses), homeUrl: "/home/"+currUserIndex,
            coursesList: JSON.stringify(courses), errmsg: "Either this course got blocked or some error occurred while registering"});
    }
});

app.get("/searchCourse", function(req, res) {
    searchCourses = [];
    if(registeredUsers[currUserIndex].usr ==='admin') {
        res.render("search", {data: {}, isModifyCourse: true, searchList: JSON.stringify(searchCourses),
        homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
    }
    else {
        res.render("search", {data: {}, isSearch: true, searchList: JSON.stringify(searchCourses), myList: JSON.stringify(mycourses), 
        homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
    }
});

app.post("/searchCourse", function(req, res) {
    var crs = Object.keys(courses).find(key => key === req.body.crsSearched || courses[key].course === req.body.crsSearched);
    searchCourses = [];
    if(!req.body.crsSearched) {
        if(registeredUsers[currUserIndex].usr ==='admin') {
            res.render("search", {data: {}, isModifyCourse: true, searchList: JSON.stringify(searchCourses),
            homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses), errmsg: "Please search a course first !!"});
        }
        else {
            res.render("search", {data: {}, isSearch: true, searchList: JSON.stringify(searchCourses), myList: JSON.stringify(mycourses), 
            homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses), errmsg: "Please search a course first !!!"});
        }
    }
    else if(crs === undefined) {
        if(registeredUsers[currUserIndex].usr ==='admin') {
            res.render("search", {data: {}, isModifyCourse: true, searchList: JSON.stringify(searchCourses),
            homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses), errmsg: "No such course exists !!"});
        }
        else {
            res.render("search", {data: {}, isSearch: true, searchList: JSON.stringify(searchCourses), myList: JSON.stringify(mycourses), 
            homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses), errmsg: "No such course exists !!!"});
        }
    }
    else {
        searchCourses.push(crs);
        if(registeredUsers[currUserIndex].usr ==='admin') {
            res.render("search", {data: req.body, isModifyCourse: true, searchList: JSON.stringify(searchCourses),  
            homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
        }
        else {
            res.render("search", {data: {}, isSearch: true, searchList: JSON.stringify(searchCourses), myList: JSON.stringify(mycourses), 
            homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
        }
    }
});

app.post("/modifyCourse", function(req, res) {
    var toModify = req.body.modifyCrsCode;
    var crs = courses[toModify];
    console.log("To Modify", crs);
    if(registeredUsers[currUserIndex].usr ==='admin' && crs !== undefined) {
        res.render("search", {data: {course: crs.course, code: toModify, dur: null, crsSearched: toModify}, isModifyCourse: true, isEdit: true, searchList: JSON.stringify(searchCourses),  
        homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses)});
    } 
    else {
        res.redirect("/searchCourse");
    }
});

//PUT middleware used for handling updation of course by admin
app.put("/modifyCourse", (req,res) => {
    var crs = Object.keys(courses).find(key => key === req.body.cs || courses[key].course === req.body.cs);
    console.log("put says --->", req.body);
    if(req.body.course == undefined || req.body.dur == undefined) {
        res.render("search", {data: {}, isModifyCourse: true, searchList: JSON.stringify(searchCourses),  
        homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses), errmsg: "Please search a course first !!!"});
        console.log("PUT -> undefined cond");
    }
    else {
        if(req.body.course=='') {
            req.body.crsSearched = crs;
            console.log("Inside to be modified",req.body);
            res.render("search", {data: req.body, isModifyCourse: true, isEdit: true, searchList: JSON.stringify(searchCourses),  
            homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses), errmsg: "Course title can't be left blanked !!"});
        }
        else {
            if(crs === undefined) {
                res.render("search", {data: {}, isModifyCourse: true, searchList: JSON.stringify(searchCourses), homeUrl: "/home/"+currUserIndex, 
                 myList: JSON.stringify(mycourses), coursesList: JSON.stringify(courses), errmsg: "No such course exists !!"});
            }
            else {
                console.log("PUT-- Inside else");
                et = courses[crs].dur; //keep the same time
                // var et = moment(courses[crs].dur,timeFormat).add(req.body.dur, "minutes").format(timeFormat); //extend the previous time
                if (req.body.dur != '')
                    var et = moment().add(req.body.dur, "minutes").format(timeFormat); //extend time from now if asked to
                let a = {
                    course: req.body.course,
                    dur: et,
                    status: 'Registrations Open',
                    stud: courses[crs].stud
                };
                courses[crs] = a;
                updateCoursesStatus(courses);
                res.render("search", {data: {}, isModifyCourse: true, searchList: JSON.stringify(searchCourses),
                homeUrl: "/home/"+currUserIndex, coursesList: JSON.stringify(courses), errmsg: "Course Updated Successfully !!"});
            }
        }
    }
});

app.post("/clearField", function(req, res) {
    if(registeredUsers[currUserIndex].usr ==='admin')
        res.redirect("/addCourse");
});

//handle all the other unmatched urls here and set status to 404
app.get('*', function(req, res) {
    res.status(404).send("Sorry, Can't find any Resource for this link");
});

function updateCoursesStatus(crsArray) {
    var currt = moment().format(timeFormat);
    Object.keys(crsArray).forEach(key => {
        if(isRegistrationGoingOn(moment(crsArray[key].dur,timeFormat),moment(currt,timeFormat))) //registrations going on
            crsArray[key].status = "Registrations Open";
        else {                                                                                  //registrations closed
            if(crsArray[key].stud >= 5)
                crsArray[key].status = "Active";      //course Activated 
            else 
                crsArray[key].status = "In-Active";   //course De-activated due to less students (i.e < 5)
        }
    });
    console.log("After updation",courses);
}

function isRegistrationGoingOn(endTime,currTime) {
    var duration = moment.duration(endTime.diff(currTime));
    var mins = duration.asMinutes();
    if (mins > 0) return true;
    else return false;
}

app.listen(3000);