
// arrays

const fruits: string[] = ['Mango', 'Banana', 'Apple'];

fruits.push('Pineapple');

// type inference in arrays

const games = ['Tomb Raider', 'GTA 5', 'Cyberpunk', 'Vice City', 4, true];

games.push(false);
games.push('Assassin Creed');



// objects

const user: {name: string, age: number, gender: string} = {
    name: 'Alex',
    age: 21,
    gender: 'Male'
}

// user.age = 'Banana';


// type inference in objects

const game = {
    name: 'Cyberpunk',
    isOnline: true
}

// game.name = 1;

export {}