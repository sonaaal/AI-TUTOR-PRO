import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* The Outlet will render the matched child route component */}
        <Outlet /> 
      </main>
      {/* You could add a Footer component here if desired */}
      {/* <Footer /> */}
    </div>
  );
};

export default Layout; 