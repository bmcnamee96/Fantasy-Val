// tScript.js
const myApp = {
    concatStrings: function (str1, str2) {
        return str1 + ' ' + str2;
    },
    addNumbers: function (num1, num2) {
        return num1 + num2;
    },
    multiplyNumbers: function (num1, num2) {
        return num1 * num2;
    }
};

// Attach the object to the window to make it globally accessible
window.myApp = myApp;

document.getElementById('button1').addEventListener('click', function() {
    alert('Button 1 clicked! This is from tScript.js');
});
