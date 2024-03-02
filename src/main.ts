//  interfaces - user defined data types (like structs in C++)

interface Author {
    name: string,
    avatar: string;
}

interface Post {
    title: string,
    author: Author, 
    date: Date,
    body: string
}

const authorOne: Author = {
    name: 'Alex',
    avatar: 'img/avatar.jpg'
}

const newPost: Post = {
    title: 'My first Post',
    body: 'Body of my Post',
    date: new Date(),
    author: authorOne
}


// with functions

const getPost = (post: Post): void => {
    console.log(`This is ${post.title} by ${post.author.name}`);
}

// with arrays

const posts: Post[] = []

posts.push(newPost);

getPost(newPost);

