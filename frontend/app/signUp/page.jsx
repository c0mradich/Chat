'use client'
import { useState, useRef } from 'react';
import "../css/styles.css"
import Link from 'next/link';

const apiURL = process.env.NEXT_PUBLIC_API_URL

export default function SignUp() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const rpassword = useRef();
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!name.trim()) newErrors.name = "Name is required";
    if (!password.trim()) newErrors.password = "Password is required";

    const repeat = rpassword.current?.value?.trim();
    if (!repeat) newErrors.repeat = "Please repeat your password";
    if (password.trim() && repeat && password.trim() !== repeat) {
      newErrors.repeat = "Passwords do not match";
    }
    return newErrors;
  };

  async function handleSubmit(e){
    e.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    try {
  
      const formData = {
        name,
        password
      };

      // Отправка данных на сервер
      const response = await fetch(`${apiURL}/addUser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
  
      const data = await response.json();
  
      if (data.success) {
        document.cookie = `username=${encodeURIComponent(name)}; path=/; max-age=3600`;
        console.log(data)
        window.location.href = "/login";
      } else {
        alert('⚠️ ' + data.message);
      }
  
    } catch (error) {
      console.error('Ошибка при отправке запроса:', error);
      alert('An error occurred while connecting to the server.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label className='loginLabel'>Sign-Up</label>
      <div className='inputContainer'>
        <input
          placeholder=" "
          name='name'
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor="name"> Name</label>
      </div>
      {errors.name && <span style={{ color: 'red' }}>{errors.name}</span>}
      <div className="inputContainer">
        <input
          name="password"
          type="password"
          placeholder=" "
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label htmlFor="password">Password</label>
      </div>
      {errors.password && <span style={{ color: 'red' }}>{errors.password}</span>}
      <div className='inputContainer'>
        <input
          name='repeatPassword'
          type="password"
          placeholder=" "
          ref={rpassword}
        />
        <label htmlFor="repeatPassword">Repeat Password</label>
      </div>
      {errors.repeat && <span style={{ color: 'red' }}>{errors.repeat}</span>}

      <button type="submit">Sign Up</button>
      <Link href="/login">You have an account? <strong>Log In!</strong></Link>
    </form>
  );
}
