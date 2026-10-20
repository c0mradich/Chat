
import requests

URL = "http://localhost:5000/addUser"

users = [
    {
        "name": f"chat_test_{i:03d}",
        "password": f"TestPass_{i:03d}_Secure!"
    }
    for i in range(1, 100)
]

success = 0
failed = 0

for i, user in enumerate(users, start=1):
    try:
        response = requests.post(
            URL,
            json=user,
            timeout=30
        )

        try:
            result = response.json()
        except ValueError:
            result = response.text[:200]

        if 200 <= response.status_code < 300:
            success += 1
            status = "OK"
        else:
            failed += 1
            status = "FAILED"

        print(
            f"[{i:02d}/50] {status} | "
            f"{user['name']} | "
            f"HTTP {response.status_code} | "
            f"{result}"
        )

    except requests.RequestException as error:
        failed += 1
        print(
            f"[{i:02d}/50] ERROR | "
            f"{user['name']} | {error}"
        )

print("\n========== SUMMARY ==========")
print(f"Всего попыток: {len(users)}")
print(f"Успешных HTTP-ответов: {success}")
print(f"Ошибок HTTP/сети: {failed}")
