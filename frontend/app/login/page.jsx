'use client';
import { useState } from 'react';
import Link from 'next/link';
import '../css/styles.css';

const apiURL = process.env.NEXT_PUBLIC_API_URL

function SignIn() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!password.trim()) newErrors.password = 'Password is required';
    return newErrors;
  };

  const handleLogin = async ({ name, password }) => {
    try {
      const res = await fetch(`${apiURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',  // Вот это важно!
        body: JSON.stringify({ name, password }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!data) throw new Error('Server returned an empty response');

      return data;
    } catch (error) {
      console.error('Error during login:', error);
      return { success: false, message: 'Error connecting to the server' };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const result = await handleLogin({ name, password });

    if (result.success) {
      document.cookie = `username=${encodeURIComponent(name)}; path=/; max-age=3600`;
      window.location.href = '/';
    } else {
      alert('⚠️ ' + result.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} method='POST'>
      <label className='loginLabel'>Login</label>
      <div className='inputContainer'>
        <input
          placeholder=" "
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor="name"> Name </label>
      </div>

      {errors.name && <span style={{ color: 'red' }}>{errors.name}</span>}
    <div className='inputContainer'>
      <input
        type="password"
        placeholder=" "
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <label htmlFor="password"> Password </label>
    </div>
      {errors.password && <span style={{ color: 'red' }}>{errors.password}</span>}

      <button type="submit">Log In</button>

      <Link href="/signUp">You don't have an account? <strong>Sign Up!</strong></Link>
    </form>
  );
}

export default SignIn;
