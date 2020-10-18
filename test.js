// FIXTURE
const {Game, Player, Cards} = require("./game.js");
const seedrandom = require('seedrandom');
const Assert = require("assert");

async function simpleGame2Players() {
  let g = new Game();
  await g.addPlayer("Alice");
  await g.addPlayer("Bob");
  await g.setup();
  return g;
}

async function simpleGame4Players() {
  let g = new Game();
  await g.addPlayer("Alice");
  await g.addPlayer("Bob");
  await g.addPlayer("Carl");
  await g.addPlayer("Denise");
  await g.setup();
  return g;
}

// START OF TEST SECTION

describe("Setup", function() {
  it("Estate count with 2 players", async () => {
    let g = await simpleGame2Players();
    Assert.equal(g._supply["Estate"].length, 8);
  });

  it("Estate count with 4 players", async () => {
    let g = await simpleGame4Players();
    Assert.equal(g._supply["Estate"].length, 12);
  });
});

describe("Buy stage", function() {
  it("Buy Cellar", async () => {
    seedrandom('hello.', { global: true });
    let g = await simpleGame2Players();
    g._activePlayer = g._players[0];
    let round = g.playRound();

    await new Promise(resolve => setTimeout(resolve, 0));
    await g.decideOption([4]);
    await new Promise(resolve => setTimeout(resolve, 0));
    Assert.equal(g._activePlayer._discard.filter(card => card.name() == "Cellar").length, 1);
  });

  it("Buy Silver", async () => {
    seedrandom('hello.', { global: true });
    let g = await simpleGame2Players();
    g._activePlayer = g._players[0];
    let round = g.playRound();

    await new Promise(resolve => setTimeout(resolve, 0));
    await g.decideOption([2]);
    await new Promise(resolve => setTimeout(resolve, 0));
    Assert.equal(g._activePlayer._discard.filter(card => card.name() == "Silver").length, 1);
  });
});

describe("Cellar", function() {
  it("Play Cellar", async () => {
    seedrandom('hello.', { global: true });
    let g = await simpleGame2Players();
    let p = g._players[0];
    g._activePlayer = p;
    let card = new Cards.Cellar();
    p._hand.push(card);
    Assert.equal(p._hand.length, 6);
    Assert.equal(p._deck.length, 5);

    let play = card.play(p, g);

    await new Promise(resolve => setTimeout(resolve, 0));
    await g.decideOption([0, 1, 2, 3, 4]);
    await new Promise(resolve => setTimeout(resolve, 0));

    await play;

    Assert.equal(p._hand.length, 5);
    Assert.equal(p._deck.length, 0);
  });
});

describe("Gardens", function() {
  it("Count gardens VP", async () => {
    seedrandom('hello.', { global: true });
    let g = await simpleGame2Players();
    let p = await g.countPoints();
    console.log(p);
    Assert.equal(p["Alice"], 3);
    Assert.equal(p["Bob"], 3);
    g._players[0]._hand.push(new Cards.Gardens());
    p = await g.countPoints();
    console.log(p);
    Assert.equal(p["Alice"], 4);
    Assert.equal(p["Bob"], 3);
  });
});

describe("Bureaucrat", function() {
  it("Play bureaucrat", async () => {
    seedrandom('hello.', { global: true });
    let g = await simpleGame4Players();
    let denise = g._players[0];
    g._players[1]._hand.push(new Cards.Moat());
    g._players[2]._hand.push(new Cards.Moat());
    g._activePlayer = denise;
    let b = new Cards.Bureaucrat();
    denise._hand.push(b);
    let playBureaucrat = b.play(denise, g);
    await new Promise(resolve => setTimeout(resolve, 0));
    // Test that it moved to _played
    Assert.ok(denise._played.includes(b));
    console.log(denise._deck);
    Assert.equal(denise._deck.filter(c => c.name() == "Silver").length, 1);

    await g.decideOption([0]); // Choose Moat and avoid attack
    await new Promise(resolve => setTimeout(resolve, 0));

    await g.decideOption([]); // Don't play moat. Affected by attack.
    await new Promise(resolve => setTimeout(resolve, 0));

    await g.decideOption([0]); // Choose Estate
    await new Promise(resolve => setTimeout(resolve, 0));

    await playBureaucrat;
  });
});

describe("Merchant", function() {
  it("Play merchant", async () => {
    seedrandom('hello.', { global: true });
    let g = await simpleGame4Players();
    let denise = g._players[0];
    g._players[1]._hand.push(new Cards.Moat());
    g._players[2]._hand.push(new Cards.Moat());
    g._activePlayer = denise;
    let b = new Cards.Bureaucrat();
    denise._hand.push(b);
    let playBureaucrat = b.play(denise, g);
    await new Promise(resolve => setTimeout(resolve, 0));
    // Test that it moved to _played
    Assert.ok(denise._played.includes(b));
    console.log(denise._deck);
    Assert.equal(denise._deck.filter(c => c.name() == "Silver").length, 1);

    await g.decideOption([0]); // Choose Moat and avoid attack
    await new Promise(resolve => setTimeout(resolve, 0));

    await g.decideOption([]); // Don't play moat. Affected by attack.
    await new Promise(resolve => setTimeout(resolve, 0));

    await g.decideOption([0]); // Choose Estate
    await new Promise(resolve => setTimeout(resolve, 0));

    await playBureaucrat;
  });
});
