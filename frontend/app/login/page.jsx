'use client';
import { useState } from 'react';
import Link from 'next/link';
import '../css/styles.css';

function SignIn() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Имя обязательно';
    if (!password.trim()) newErrors.password = 'Пароль обязателен';
    return newErrors;
  };

  const handleLogin = async ({ name, password }) => {
    try {
      const res = await fetch('http://localhost:5000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',  // Вот это важно!
        body: JSON.stringify({ name, password }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!data) throw new Error('Сервер вернул пустой ответ');

      return data;
    } catch (error) {
      console.error('Ошибка при логине:', error);
      return { success: false, message: 'Ошибка соединения с сервером' };
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
      alert('✅ ' + result.message);
      window.location.href = '/';
    } else {
      alert('⚠️ ' + result.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} method='POST'>
      <label>Login</label>
      <div className='inputContainer'>
        <input
          placeholder="Имя"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {errors.name && <span style={{ color: 'red' }}>{errors.name}</span>}
    <div className='inputContainer'>
      <input
        type="password"
        placeholder="Пароль"
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </div>
      {errors.password && <span style={{ color: 'red' }}>{errors.password}</span>}

      <button type="submit">Войти</button>

      <Link href="/signUp">You don't have an account? <strong>Sign Up!</strong></Link>
    </form>
  );
}

export default SignIn;
