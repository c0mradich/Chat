'use client'
import { useState, useRef } from 'react';
import "../css/styles.css"
import Link from 'next/link';

export default function SignUp() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const rpassword = useRef();
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!name.trim()) newErrors.name = "Имя обязательно";
    if (!password.trim()) newErrors.password = "Пароль обязателен";

    const repeat = rpassword.current?.value?.trim();
    if (!repeat) newErrors.repeat = "Повторите пароль";
    if (password.trim() && repeat && password.trim() !== repeat) {
      newErrors.repeat = "Пароли не совпадают";
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
      // Подготовка данных для отправки
      const formData = {
        name,
        password
      };

      // Отправка данных на сервер
      const response = await fetch('http://localhost:5000/addUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',  // Указываем, что отправляем JSON
        },
        body: JSON.stringify(formData),  // Преобразуем данные в строку JSON
      });
  
      const data = await response.json();
  
      if (data.success) {
        document.cookie = `username=${encodeURIComponent(name)}; path=/; max-age=3600`;
        alert('✅ ' + data.message);
        console.log(data)
        window.location.href = "/login";
      } else {
        alert('⚠️ ' + data.message);
      }
  
    } catch (error) {
      console.error('Ошибка при отправке запроса:', error);
      alert('Произошла ошибка при соединении с сервером.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>Sign-Up</label>
      <input
        placeholder="Имя"
        name='name'
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {errors.name && <span style={{ color: 'red' }}>{errors.name}</span>}

      <input
        name="password"
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {errors.password && <span style={{ color: 'red' }}>{errors.password}</span>}

      <input
        name='repeatPassword'
        type="password"
        placeholder="Повторите пароль"
        ref={rpassword}
      />
      {errors.repeat && <span style={{ color: 'red' }}>{errors.repeat}</span>}

      <button type="submit">Войти</button>
      <Link href="/login">You have an account? <strong>Log In!</strong></Link>
    </form>
  );
}
