"use strict";
//  interfaces - user defined data types (like structs in C++)
const authorOne = {
    name: 'Alex',
    avatar: 'img/avatar.jpg'
};
const newPost = {
    title: 'My first Post',
    body: 'Body of my Post',
    date: new Date(),
    author: authorOne
};
// with functions
const getPost = (post) => {
    console.log(`This is ${post.title} by ${post.author.name}`);
};
// with arrays
const posts = [];
posts.push(newPost);
getPost(newPost);
