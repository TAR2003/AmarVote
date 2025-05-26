import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [message, setMessage] = useState('Loading...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Make API call to backend when component mounts
    const fetchData = async () => {
      try {
        setLoading(true);
        // Call the backend at the configured API URL
        const apiUrl = process.env.REACT_APP_API_URL;
        console.log('Calling API at:', `${apiUrl}/users/count`);
        const response = await axios.get(`${apiUrl}/users/count`);
        setMessage(response.data);
        setError(null);
      } catch (err) {
        setError('Error fetching data from backend: ' + err.message);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>AmarVote Frontend</h1>
        <div className="content">
          {loading ? (
            <p>Loading data from backend...</p>
          ) : error ? (
            <div className="error-message">
              <p>{error}</p>
              <p>Make sure the backend is running at localhost:8080</p>
            </div>
          ) : (
            <div className="response-container">
              <h2>Response from Backend:</h2>
              <pre>{JSON.stringify(message, null, 2)}</pre>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
