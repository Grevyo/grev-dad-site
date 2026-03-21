import React, { useEffect, useState } from 'react';

const Store = () => {
  const [cases, setCases] = useState([]);

  useEffect(() => {
    fetch('/api/cs2/cases')
      .then(response => response.json())
      .then(data => {
        // Assuming data is an array of case objects
        setCases(data.sort((a, b) => a.price - b.price)); // Sort by price
      });
  }, []);

  const handleCaseClick = (caseId) => {
    // Logic to open case contents and drop percentages
  };

  return (
    <div className="case-grid">
      {cases.map(csCase => (
        <div key={csCase.id} className="case-item" onClick={() => handleCaseClick(csCase.id)}>
          <img src={csCase.imageUrl} alt={csCase.name} />
          <h3>{csCase.name}</h3>
          <p>Price: ${csCase.price}</p>
        </div>
      ))}
    </div>
  );
};

export default Store;