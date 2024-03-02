// type aliases

// with tuples
type RGB = [number, number, number];

function getColor(): RGB {
    const r = Math.floor(Math.random()*255);
    const g = Math.floor(Math.random()*255);
    const b = Math.floor(Math.random()*255);

    return [r, g, b];
}

console.log(getColor());

// with objects

type User = {
    name: string,
    score: number
}

const userOne: User = {
    name: 'Alex',
    score: 86
}

const printUser = (user: User): void => {
    console.log(`User is ${user.name} with score ${user.score}`);
}

printUser(userOne);