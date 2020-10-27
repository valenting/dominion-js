// FIXTURE
const {Game, Player, Cards} = require("./game.js");
const seedrandom = require('seedrandom');
const Assert = require("assert");

async function simpleGame2Players() {
  seedrandom('hello.', { global: true });
  let g = new Game();
  await g.addPlayer("Alice");
  await g.addPlayer("Bob");
  await g.setup();
  return g;
}

async function simpleGame4Players() {
  seedrandom('hello.', { global: true });
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
    let g = await simpleGame2Players();
    g._activePlayer = g._players[0];
    let round = g.playRound();

    await new Promise(resolve => setTimeout(resolve, 0));
    await g.decideOption([4]);
    await new Promise(resolve => setTimeout(resolve, 0));
    Assert.equal(g._activePlayer._discard.filter(card => card.name() == "Cellar").length, 1);
  });

  it("Buy Silver", async () => {
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

describe("Chapel", function() {
  it("Play Chapel", async () => {
    let g = await simpleGame2Players();
    let p = g._players[0];
    g._activePlayer = p;
    let card = new Cards.Chapel();

    p._hand.push(card);
    Assert.equal(p._hand.length, 6);
    Assert.equal(p._deck.length, 5);

    let play = card.play(p, g);

    await new Promise(resolve => setTimeout(resolve, 0));
    await g.decideOption([0, 1]);
    await new Promise(resolve => setTimeout(resolve, 0));

    await play;
    Assert.equal(p._hand.length, 3);
    Assert.equal(g._trash.length, 2);
  });
});

describe("Gardens", function() {
  it("Count gardens VP", async () => {
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

describe("Moat", function() {
  it("Play Moat", async () => {
    let g = await simpleGame2Players();
    let moat = new Cards.Moat();
    let p = g._players[0];
    p._hand.push(moat);
    Assert.equal(p._hand.length, 6);
    await moat.play(p, g);
    // play moat, draw 2
    Assert.equal(p._hand.length, 7);
  });
});

describe("Harbinger", function() {
  it("Play Harbinger Empty", async () => {
    let g = await simpleGame2Players();
    let harbinger = new Cards.Harbinger();
    let p = g._players[0];
    p._hand.push(harbinger);
    Assert.equal(p._hand.length, 6);
    Assert.equal(p._discard.length, 0);
    await harbinger.play(p, g);
    Assert.equal(p._hand.length, 6);
    Assert.equal(g._activeChoice, null); // No cards in hand. Nothing to choose
  });
  it("Play Harbinger Choose", async () => {
    let g = await simpleGame2Players();
    let harbinger = new Cards.Harbinger();
    let p = g._players[0];
    p._hand.push(harbinger);
    Assert.equal(p._hand.length, 6);
    Assert.equal(p._discard.length, 0);
    p._discard.push(new Cards.Copper());
    p._discard.push(new Cards.Gold());
    Assert.equal(p._deck.length, 5);
    let action = harbinger.play(p, g);
    await new Promise(resolve => setTimeout(resolve, 0));
    Assert.equal(p._hand.length, 6);
    Assert.equal(p._deck.length, 4);
    Assert.notEqual(g._activeChoice, null);
    Assert.equal(g._activeChoice.options.length, 2);
    await g.decideOption([1]);
    await new Promise(resolve => setTimeout(resolve, 0));
    Assert.equal(p._deck.length, 5);
    Assert.equal(p._discard.length, 1);
    await action;
  });
});

