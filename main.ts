

let myname = 'Piyush';

// myname = 6;


// Benifits

// 1.) better error feedback

function reverse(str: string){
    return str.split('').reverse().join('');
}

const result = reverse('hello');

// 2.) better autocompletion & code hints

const reversed = reverse('Alex');

console.log(reversed);

// 3.) custom types

interface MenuItem{
    title: string,
    cost: number
}

function printMenuItem(item: MenuItem){
    console.log(item.title, ':', item.cost);
}

// error example
// printMenuItem()

// printMenuItem({ title: 'A Title' , cost : '15'});


printMenuItem({ title: 'A Title', cost: 15 });

// 4.) self documenting

export {}