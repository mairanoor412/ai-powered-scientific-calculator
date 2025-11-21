class Calculator {
    constructor(expressionDisplay, resultDisplay) {
        this.expressionDisplay = expressionDisplay;
        this.resultDisplay = resultDisplay;
        this.clear();
        this.scientificMode = false;
        this.angleMode = 'deg'; // 'deg' or 'rad'
    }

    clear() {
        this.expression = ''; // The full expression being built
        this.currentResult = ''; // The result of the automatic calculation
        this.hasError = false; // Flag for calculation errors
        this.lastInputWasEquals = false; // True if the last action was '='
        this.updateDisplay();
    }

    delete() {
        if (this.lastInputWasEquals || this.hasError) {
            this.clear();
        } else {
            // Remove the class first to allow re-triggering the animation
            this.expressionDisplay.classList.remove('deleting');
            // Force a reflow to ensure the class removal is processed before re-adding
            void this.expressionDisplay.offsetWidth; 
            
            // Apply the deleting animation
            this.expressionDisplay.classList.add('deleting');

            this.expression = this.expression.slice(0, -1);
            this.autoCalculate(); // Update internal state before display update

            // The content change should happen instantly for calculation accuracy,
            // while the animation provides visual feedback for the 'deletion' action.
            this.updateDisplay();

            // Remove the class after the animation duration to reset the element
            setTimeout(() => {
                this.expressionDisplay.classList.remove('deleting');
            }, 150); // Matches the animation duration in CSS
        }
    }

    appendNumber(number) {
        if (this.hasError || this.lastInputWasEquals) {
            this.clear();
        }

        if (number === '.' && this.expression.endsWith('.')) return;

        const lastChar = this.expression.slice(-1);
        // Implicit multiplication: if a number is pressed after a closing parenthesis or a constant (like pi or e)
        if (number !== '.' && (lastChar === ')' || lastChar === 'π' || lastChar === 'e')) {
            this.expression += '*';
        }
        
        // Prevent multiple leading zeros unless a decimal is present
        if (this.expression === '0' && number !== '.') {
            this.expression = number.toString();
        } else {
            this.expression += number.toString();
        }
        
        this.lastInputWasEquals = false;
        this.autoCalculate();
        this.updateDisplay();
    }

    chooseOperation(operator) {
        if (this.hasError) return;
        if (this.lastInputWasEquals) {
            this.expression = this.currentResult;
            this.lastInputWasEquals = false;
        }

        const lastChar = this.expression.slice(-1);
        const operators = ['+', '-', '*', '÷', '%', '^'];

        if (this.expression === '' && operator !== '-') { // Allow leading minus for negative numbers
            return; // Prevent leading operators like +, *, /
        }

        if (operators.includes(lastChar) && operators.includes(operator)) {
            // If the last character is an operator and the new input is also an operator, replace it
            this.expression = this.expression.slice(0, -1) + operator;
        } else {
            this.expression += operator;
        }
        
        this.autoCalculate();
        this.updateDisplay();
    }

    appendOperator(operator) { // 'operator' here could be '**2', '!', 'sin(', etc.
        if (this.hasError) return;
        if (this.lastInputWasEquals) {
            this.expression = this.currentResult;
            this.lastInputWasEquals = false;
        }

        const lastChar = this.expression.slice(-1);
        const isNumericOrParen = /\d|\)/.test(lastChar); // Checks if last char is a number or ')'
        const isConstant = (lastChar === 'π' || lastChar === 'e');
        const isPrefixFunction = ['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt(', 'exp('].includes(operator);

        // Implicit multiplication for functions if preceded by a number, constant, or ')'
        if (isPrefixFunction && (isNumericOrParen || isConstant)) {
            this.expression += '*';
        }

        // Handle cases for unary operators and functions
        if (operator === '**2' || operator === '**3' || operator === '!') {
            // Postfix operators
            this.expression += operator;
        } else if (isPrefixFunction) {
            // Prefix functions
            this.expression += operator;
        }
        // Constants like pi, e are handled by appendNumber in event listener, so no need here.
        
        this.autoCalculate();
        this.updateDisplay();
    }

    appendParenthesis(paren) {
        if (this.hasError) {
            this.clear(); // Clear error state
        }
        if (this.lastInputWasEquals) {
            if (paren === '(') {
                this.clear(); // Start new expression
            } else {
                this.expression = this.currentResult; // Continue with result
            }
            this.lastInputWasEquals = false;
        }

        const lastChar = this.expression.slice(-1);
        // Implicit multiplication for '(' if preceded by a number, constant, or ')'
        if (paren === '(' && (/\d|\)|π|e/.test(lastChar))) {
            this.expression += '*';
        }
        
        this.expression += paren;
        this.autoCalculate();
        this.updateDisplay();
    }


    toggleScientificMode() {
        this.scientificMode = !this.scientificMode;
        document.querySelector('.calculator').classList.toggle('scientific-mode', this.scientificMode);
        this._adjustDisplayFontSize(this.expressionDisplay); // Adjust font size after layout change
        this._adjustDisplayFontSize(this.resultDisplay); // Adjust font size after layout change
    }

    autoCalculate() {
        if (this.expression === '') {
            this.currentResult = '';
            this.hasError = false;
            return;
        }

        let expressionToEvaluate = this.expression;
        const operators = ['+', '-', '*', '÷', '%', '^'];
        
        // --- Preliminary checks for incomplete expressions ---

        // Check for unbalanced parentheses
        let openParenthesesCount = (expressionToEvaluate.match(/\(/g) || []).length;
        let closeParenthesesCount = (expressionToEvaluate.match(/\)/g) || []).length;

        // If more open than close parentheses, or expression ends with an opening parenthesis,
        // it's likely incomplete, so don't evaluate fully yet.
        if (openParenthesesCount > closeParenthesesCount || expressionToEvaluate.endsWith('(')) {
            this.currentResult = '';
            this.hasError = false;
            this.updateDisplay(); // Important to update here to reflect empty result
            return;
        }

        // Check for trailing binary operators (already handled, but ensure it doesn't cause error for function calls)
        let trailingOperator = '';
        if (operators.includes(expressionToEvaluate.slice(-1))) {
            trailingOperator = expressionToEvaluate.slice(-1); // Keep track of it
            expressionToEvaluate = expressionToEvaluate.slice(0, -1); // Evaluate without it
        }
        
        // If, after removing a trailing operator, the expression is empty, return empty result
        if (expressionToEvaluate === '') {
             this.currentResult = '';
             this.hasError = false;
             this.updateDisplay(); // Important to update here to reflect empty result
             return;
        }

        // Check for incomplete scientific function calls like 'sin('
        // This is a basic check; a more sophisticated parser would be needed for complex cases.
        const incompleteFuncRegex = /(sin|cos|tan|log|ln|sqrt|exp)\([^)]*$/;
        if (incompleteFuncRegex.test(expressionToEvaluate)) {
            this.currentResult = '';
            this.hasError = false;
            this.updateDisplay(); // Important to update here to reflect empty result
            return;
        }


        // --- Actual Evaluation (only if expression seems complete enough) ---

        // Replace custom operators with JS-compatible ones
        expressionToEvaluate = expressionToEvaluate
            .replace(/÷/g, '/')
            .replace(/x/g, '*')
            .replace(/\^/g, '**');

        // Handle scientific constants
        expressionToEvaluate = expressionToEvaluate.replace(/π/g, 'Math.PI').replace(/e(?![a-zA-Z])/g, 'Math.E');

        // Handle factorial
        expressionToEvaluate = expressionToEvaluate.replace(/(\d+(\.\d+)?)!/g, (match, numStr) => {
            const n = parseFloat(numStr);
            if (n < 0 || n !== Math.floor(n)) throw new Error('Factorial of non-integer or negative number');
            let res = 1;
            for (let i = 2; i <= n; i++) res *= i;
            return res;
        });

        // Handle x^2 and x^3
        expressionToEvaluate = expressionToEvaluate.replace(/(\d+(\.\d+)?|\([^)]+\))\*\*(2)/g, (match, base) => `Math.pow(${base}, 2)`);
        expressionToEvaluate = expressionToEvaluate.replace(/(\d+(\.\d+)?|\([^)]+\))\*\*(3)/g, (match, base) => `Math.pow(${base}, 3)`);

        const evaluateFunc = (func, arg) => {
            const evaluatedArg = this.evaluateSubExpression(arg);
            if (isNaN(evaluatedArg)) throw new Error('Invalid function argument');
            switch (func) {
                case 'sin': return Math.sin(this.convertToRadians(evaluatedArg));
                case 'cos': return Math.cos(this.convertToRadians(evaluatedArg));
                case 'tan': return Math.tan(this.convertToRadians(evaluatedArg));
                case 'log': return Math.log10(evaluatedArg);
                case 'ln': return Math.log(evaluatedArg);
                case 'sqrt': return Math.sqrt(evaluatedArg);
                case 'exp': return Math.exp(evaluatedArg);
                default: return evaluatedArg;
            }
        };

        // Handle scientific functions (sin, cos, tan, log, ln, sqrt, exp)
        expressionToEvaluate = expressionToEvaluate.replace(/(sin|cos|tan|log|ln|sqrt|exp)\(([^)]*)\)/g, (match, func, arg) => {
            return evaluateFunc(func, arg);
        });

        try {
            // Attempt to evaluate the expression
            const computation = new Function('return ' + expressionToEvaluate)();
            if (isNaN(computation) || !isFinite(computation)) {
                throw new Error('Invalid calculation');
            }
            this.currentResult = computation.toFixed(10).replace(/\.?0+$/, '');
            this.hasError = false;
        } catch (error) {
            this.currentResult = 'Error';
            this.hasError = true;
            console.error('Auto-calculation error:', error);
        }
    }

    // Helper to evaluate sub-expressions within function calls
    evaluateSubExpression(subExpression) {
        try {
            subExpression = subExpression.replace(/÷/g, '/').replace(/x/g, '*').replace(/\^/g, '**');
            subExpression = subExpression.replace(/π/g, 'Math.PI').replace(/e(?![a-zA-Z])/g, 'Math.E');
            return new Function('return ' + subExpression)();
        } catch (e) {
            throw new Error('Invalid sub-expression: ' + subExpression);
        }
    }

    convertToRadians(angle) {
        return this.angleMode === 'deg' ? angle * (Math.PI / 180) : angle;
    }

    updateDisplay() {
        this.expressionDisplay.innerText = this.expression;
        if (this.hasError) {
            this.resultDisplay.innerText = 'Error';
        } else if (this.currentResult === '' && this.expression === '') {
            this.resultDisplay.innerText = '0';
        } else if (this.lastInputWasEquals && this.currentResult !== '') {
            this.resultDisplay.innerText = this.currentResult;
        } else {
            this.resultDisplay.innerText = this.currentResult || ''; // Show currentResult or empty if it's being built
        }
        this._adjustDisplayFontSize(this.expressionDisplay);
        this._adjustDisplayFontSize(this.resultDisplay);
    }

    calculate() {
        if (this.hasError) {
            this.clear();
            return;
        }

        this.autoCalculate(); // Perform final calculation
        if (!this.hasError) {
            // Update expression display to show the full equation with the result
            this.expressionDisplay.innerText = `${this.expression} =`;
            // The result display already has the currentResult from autoCalculate
            this.expression = this.currentResult; // Set expression to result for chaining operations
        }
        this.lastInputWasEquals = true; // Mark that equals was just pressed
        this.updateDisplay();
    }

    _adjustDisplayFontSize(displayElement) {
        // Reset font size to default/max before measuring to ensure accurate recalculation
        displayElement.style.fontSize = ''; 

        // Get the initial computed font size (from CSS) to use as the maximum
        let currentFontSize = parseFloat(window.getComputedStyle(displayElement).fontSize);
        const initialRemSize = currentFontSize / parseFloat(window.getComputedStyle(document.documentElement).fontSize); // Convert px to rem for min check

        const minFontSizeRem = 0.7; // Minimum readable font size in rem

        // Loop to scale down until text fits or minFontSize is reached
        // Use a small factor for smooth, gradual scaling
        while (displayElement.scrollWidth > displayElement.clientWidth && initialRemSize > minFontSizeRem) {
            currentFontSize -= 1; // Decrement by 1px
            displayElement.style.fontSize = `${currentFontSize}px`;

            // Re-evaluate current rem size to check against minFontSizeRem
            const newRemSize = currentFontSize / parseFloat(window.getComputedStyle(document.documentElement).fontSize);
            if (newRemSize <= minFontSizeRem) {
                displayElement.style.fontSize = `${minFontSizeRem}rem`;
                break;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const expressionDisplay = document.getElementById('expression-display');
    const resultDisplay = document.getElementById('result-display');
    const calculatorButtons = document.querySelector('.buttons');
    const toggleScientificButton = document.querySelector('[data-action="toggleScientific"]');

    const calculator = new Calculator(expressionDisplay, resultDisplay);

    calculatorButtons.addEventListener('click', e => {
        const target = e.target;
        if (!target.matches('button')) return;

        const dataAction = target.dataset.action;
        const dataNumber = target.dataset.number;
        const dataOperator = target.dataset.operator;

        if (dataNumber !== undefined) {
            calculator.appendNumber(target.innerText);
        } else if (dataAction === 'clear') {
            calculator.clear();
        } else if (dataAction === 'delete') {
            calculator.delete();
        } else if (dataAction === 'equals') {
            calculator.calculate();
            // updateDisplay is called by calculate(), no need to call it again here.
        } else if (dataOperator !== undefined) {
            // Check for binary operators
            if (['+', '-', '*', '÷', '%', '^'].includes(dataOperator)) {
                calculator.chooseOperation(dataOperator); // Use the new chooseOperation method
            } else if (['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'x^2', 'x^3', 'exp', 'pi', 'e', '!'].includes(dataOperator)) {
                // Handle scientific operators by passing to appendOperator for now
                // These will need further integration with the new state model
                if (dataOperator === 'pi') {
                    calculator.appendNumber(Math.PI.toFixed(10).replace(/\.?0+$/, ''));
                } else if (dataOperator === 'e') {
                    calculator.appendNumber(Math.E.toFixed(10).replace(/\.?0+$/, ''));
                } else if (dataOperator === 'x^2') {
                    calculator.appendOperator('**2');
                } else if (dataOperator === 'x^3') {
                    calculator.appendOperator('**3');
                } else if (dataOperator === '!') {
                    calculator.appendOperator('!');
                } else { // Unary functions like sin, cos, etc.
                    calculator.appendOperator(`${dataOperator}(`);
                }
            } else if (['(', ')'].includes(dataOperator)) {
                calculator.appendParenthesis(target.innerText);
            }
        }
    });

    toggleScientificButton.addEventListener('click', () => {
        calculator.toggleScientificMode();
    });
});