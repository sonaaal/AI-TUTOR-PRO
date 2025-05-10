# backend/graphing.py
import matplotlib
matplotlib.use('Agg') # Use non-interactive backend suitable for web servers
import matplotlib.pyplot as plt
import numpy as np
import sympy
import io
import base64
import logging

logger = logging.getLogger(__name__)

def generate_graph(equation_str: str) -> str:
    """Generates a plot of a y=f(x) style equation and returns a base64 data URL."""
    logger.info(f"Generating graph for equation: {equation_str}")
    
    x = sympy.symbols('x')
    y_expr = None
    
    try:
        # Try to parse the equation, assuming it's in the form "y = ..." or just the expression for y
        if '=' in equation_str:
            lhs_str, rhs_str = map(str.strip, equation_str.split('=', 1))
            if lhs_str == 'y':
                y_expr = sympy.parse_expr(rhs_str, transformations='all')
            else:
                # Try solving for y (might be complex or fail)
                 parsed_eq = sympy.sympify(f"Eq({lhs_str}, {rhs_str})")
                 solutions = sympy.solve(parsed_eq, sympy.symbols('y'))
                 if solutions: # Take the first solution if multiple exist
                    y_expr = solutions[0]
                 else:
                      raise ValueError("Could not solve equation for y.")
        else:
            # Assume the input is just the expression for y
            y_expr = sympy.parse_expr(equation_str, transformations='all')

        if not y_expr or not y_expr.has(x):
             raise ValueError("Invalid expression or expression does not depend on x.")

        # Convert the SymPy expression to a NumPy-callable function
        y_func = sympy.lambdify(x, y_expr, modules=['numpy'])

        # Generate x values
        x_vals = np.linspace(-10, 10, 400) # Range -10 to 10, 400 points
        
        # Calculate y values, handling potential errors
        try:
             # Suppress warnings during evaluation (e.g., division by zero)
             with np.errstate(divide='ignore', invalid='ignore'):
                 y_vals = y_func(x_vals)
             # Replace infinities or NaNs with NaN so Matplotlib doesn't connect across them
             y_vals[~np.isfinite(y_vals)] = np.nan 
        except Exception as eval_err:
             logger.error(f"Error evaluating expression for plotting: {eval_err}")
             raise ValueError(f"Could not evaluate expression: {eval_err}")

        # Create the plot
        fig, ax = plt.subplots(figsize=(6, 4)) # Adjust size as needed
        ax.plot(x_vals, y_vals)
        ax.set_xlabel("x")
        ax.set_ylabel("y")
        ax.set_title(f"Graph of ${sympy.latex(y_expr)}$") # Use LaTeX for title
        ax.grid(True)
        ax.axhline(0, color='black', linewidth=0.5) # x-axis
        ax.axvline(0, color='black', linewidth=0.5) # y-axis
        # Improve layout
        fig.tight_layout()

        # Save plot to a BytesIO buffer
        buf = io.BytesIO()
        fig.savefig(buf, format='png')
        buf.seek(0)
        plt.close(fig) # Close the figure to free memory

        # Encode image to base64
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        buf.close()

        logger.info(f"Successfully generated graph for: {equation_str}")
        return f"data:image/png;base64,{img_base64}"

    except (SyntaxError, TypeError, ValueError) as parse_err:
        logger.warning(f"Failed to parse/process equation '{equation_str}': {parse_err}")
        raise ValueError(f"Invalid equation format or content: {parse_err}")
    except Exception as e:
        logger.error(f"Unexpected error generating graph for '{equation_str}': {e}", exc_info=True)
        raise RuntimeError(f"An unexpected error occurred while generating the graph: {e}") 