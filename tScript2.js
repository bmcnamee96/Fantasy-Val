// tScript2.js
document.getElementById('button2').addEventListener('click', function() {
    // Call the functions defined in tScript.js
    const concatResult = window.myApp.concatStrings('Hello', 'World');
    const addResult = window.myApp.addNumbers(5, 10);
    const multiplyResult = window.myApp.multiplyNumbers(5, 10);

    alert('Button 2 clicked!\n' +
          'Concat Result: ' + concatResult + '\n' +
          'Add Result: ' + addResult + '\n' +
          'Multiply Result: ' + multiplyResult);
});
