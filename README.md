Это мой первый кот 🐈, на голом fastify

Исходя из тз я думал что собираетесь смотреть как я итерирую данные из внешней API, и знании о транзакциях. И закостылился где можно, например
- Нет чистой (onion) архитектуры с иньекциями зависимостей (DI)
- Не собрал в докер с сервисами как posgtres и redis (так как в тз не было). Из-за этого имитация кэша не будет правильно работать при запуске более одного инстанса проекта
- Весь код в одном коммите

Для запуска проекта:
- Cоздаете новую базу (ex: skinport)
- В терминале
  1. git clone https://github.com/akhmedmukhtarov/skinport.git
  2. cd skinport
  2. npm i
- В .env меняете значение на DATABASE_URL=postgres://your_pg_user:your_pg_password@localhost:5432/skinport где your_pg_user и your_pg_password ваш юзер и пароль от постгреса
- Для старта в watch mode в терминале пишите npm run start:dev
- Для старта в prod npm run start