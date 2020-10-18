# dominion-js

This is a small implementation of the Dominion game. I wrote for fun.

# Install

```bash
npm install # fetch node dependencies
npm test # run unit tests
```

# Run

Open `index.html`. Open the console.
Run:
```js

  let g = new Game();
  await g.addPlayer("Alice");
  await g.addPlayer("Bob");
  await g.start();
```

For now the game can only be played on a a single keyboard. When prompted by the message, you can choose from a list of presented options by typing:

```js
await g.decideOption([0]);
```

where `0` is the index of the user's choice in the list.

# TODO

- [ ] Implement UI
- [ ] Add webrtc code to allow playing with remote users
- [ ] More dominion cards
- [ ] Write unit tests for every card
- [ ] Fuzzing
