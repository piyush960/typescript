
let age: any = 2;

age = '2';
age = false;

let title;
title = 2;
title = 'Apple';

title = {
    title: 'Hello World',
}


const getName = (value: any): number => {
    return value + value
}

const result = getName('1');
console.log(result);

// useful when migrating project from js to ts