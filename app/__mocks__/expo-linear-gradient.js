const React = require('react');
module.exports = {
  LinearGradient: React.forwardRef(({ children, ...props }, ref) =>
    React.createElement('LinearGradient', { ...props, ref }, children)
  ),
};
