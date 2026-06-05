import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen loading-screen">
          <div className="loading-card paper-card">
            <p>문제가 생겼어. 새로고침해서 다시 열어줘.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
