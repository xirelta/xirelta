# Xirelta Web Framework

<p align="left">
  <img src="./.github/assets/logo.png" alt="Xirelta Logo" width="100" height="100"/>
</p>

Xirelta is a lightweight web framework for building web applications in TypeScript with Bun. It is designed to be flexible and easy to use, allowing you to create web services and applications with minimal effort.

## Installation

You can install Xirelta using Bun:

```bash
bun add xirelta
```

## Getting Started

To get started with Xirelta, you need to create an instance of the `Application` class and define your routes and handlers. Here's a basic example:

```typescript
import { Application } from 'xirelta';

const app = new Application();

app.get('/', (request) => {
  return 'Hello, Xirelta!';
});

app.start().then((serverInfo) => {
  console.log(`Server is running on port ${serverInfo.port}`);
});
```

In this example, we create a simple web server that listens on the root path and responds with "Hello, Xirelta!" when accessed.

## Defining Routes

You can define routes for various HTTP methods using the following methods:

- `app.all(path, handler)`: Matches all HTTP methods.
- `app.get(path, handler)`: Matches GET requests.
- `app.post(path, handler)`: Matches POST requests.
- `app.put(path, handler)`: Matches PUT requests.
- `app.delete(path, handler)`: Matches DELETE requests.

The `path` parameter is a string that defines the URL pattern for the route, and the `handler` parameter is a function that handles the incoming requests and returns a response.

## Handling Requests

The `handler` function takes a request object as its parameter, which contains information about the incoming request. You can access parameters, query strings, request bodies, and more from this object.

Here's an example of handling a GET request with a parameter:

```typescript
app.get('/user/:id', (request) => {
  const userId = request.params.id;
  // Retrieve user data based on the userId
  const user = getUserById(userId);
  if (!user) {
    return new Response('User not found', { status: 404 });
  }
  return user;
});
```

In this example, we define a route with a parameter `:id` in the URL pattern. We then access this parameter using `request.params.id` and use it to retrieve user data.

## Custom Responses

You can return custom responses using the `Response` class or plain JSON objects. Xirelta will handle serializing these responses appropriately.

```typescript
app.get('/json', (request) => {
  return {
    message: 'This is a JSON response',
  };
});

app.get('/custom-response', (request) => {
  return new Response('Custom Response', { status: 200, headers: { 'Content-Type': 'text/plain' } });
});
```

## Starting and Stopping the Server

To start the Xirelta web server, call the `start` method on your `Application` instance. It returns a promise that resolves with information about the server, including the port it's listening on.

```typescript
app.start().then((serverInfo) => {
  console.log(`Server is running on port ${serverInfo.port}`);
});
```

To stop the server, use the `stop` method:

```typescript
app.stop().then(() => {
  console.log('Server has stopped');
});
```

## Configuration

Xirelta allows you to configure various options for your application, including the web server's port and logging. You can pass a configuration object when creating an `Application` instance:

```typescript
const config = {
  web: {
    port: 8080, // Set the port to 8080
  },
  logger: {
    debug(message, options) {
      console.debug(message, options);
    },
    info(message, options) {
      console.info(message, options);
    },
  },
};

const app = new Application(config);
```

## License

MIT
