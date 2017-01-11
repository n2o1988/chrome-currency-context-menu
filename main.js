// currencies supported
var currencies = [
  { id: 'EUR', symbol: '€' },
  { id: 'GBP', symbol: '£' },
  { id: 'USD', symbol: '$' }
];
var selectedFavourite = currencies[0].id;
var defaultSource = 'AAGBP';// todo: programmatically
var defaultWebsitesCurrencies = [
  { url: 'https://www.amazon.co.uk', currency: 'GBP' },
  { url: 'https://www.amazon.com', currency: 'USD' },
  { url: 'https://www.amazon.it', currency: 'EUR' }
];// todo: configurable
var mainItem = chrome.contextMenus.create({
  title: getMainItemTitle(),
  contexts: ['selection']
});

var currenciesMenuItems = currencies.map(function(currency) {
  return {
    id: currency.id,
    item: chrome.contextMenus.create({
      title: currency.id,
      type: 'radio',
      checked: currency.id === selectedFavourite,
      onclick: onSelected,
      parentId: mainItem,
      contexts: ['selection']
    })
  };
});

// retrieve saved pref
chrome.storage.sync.get('favouriteOption', (fav) => {
  if (fav.favouriteOption) {
    var item = currenciesMenuItems.find(it => it.id === fav.favouriteOption);
    if (item) {
      selectedFavourite = fav.favouriteOption;
      chrome.contextMenus.update(item.item, { checked: true });
      updateMainItemTitle();
    }
  }
});

function getMainItemTitle() {
  return 'Currency Convert %s to (' + selectedFavourite + ')';
}

function updateMainItemTitle() {
  chrome.contextMenus.update(mainItem, { title: getMainItemTitle() });
}

function getDefaultCurrency(url) {
  var website = defaultWebsitesCurrencies.find(site => url.indexOf(site.url) === 0);
  if (website) {
    return website.currency;
  }
  return defaultSource;
}

function isDigitOrDot(char) {
  return /([0-9])|\.|,/.test(char);
}

function getMetaData(url, text) {
  // search for a currency symbol.
  var source = getDefaultCurrency(url);
  var firstDigitIndex = 0;
  currencies.forEach(curr => {
    var index = text.indexOf(curr.symbol);
    var symbolLength;
    if (index > -1 ) {
      // get value just after the index;
      symbolLength = curr.symbol.length;
    } else {
      // try with id
      index = text.indexOf(curr.id);
      if (index === 0) {
        symbolLength = curr.id.length;
      }
    }
    if (symbolLength) {
      firstDigitIndex = index + symbolLength;
      source = curr.id;
    }
  });

  var numStr = '';
  while (firstDigitIndex < text.length && isDigitOrDot(text[firstDigitIndex])) {
    numStr += text[firstDigitIndex] === ',' ? '.' : text[firstDigitIndex];
    firstDigitIndex++;
  }
  var numericValue = parseFloat(numStr);
  if (isNaN(numericValue)) {
    return null;
  }
  return {
    source: source,
    value: numericValue
  };
}

function convert(target, tab, selectionText) {
  //breakdown
  var metaData = getMetaData(tab.url, selectionText);
  if (!metaData || metaData.source === target) {
    return;
  }
  metaData.target = target;
  chrome.tabs.executeScript(tab.id, {
    code: `var selectionText = ${JSON.stringify(metaData)};`
  }, function() {
      chrome.tabs.executeScript(tab.id, {file: "dom.js"});
  });
}

function onSelected(menuItem, tab) {
  // get the item
  var item = currenciesMenuItems.find(it => it.item === menuItem.menuItemId);
  if (item) {
    // do translation
    convert(item.id, tab, menuItem.selectionText);
    if (item.id !== selectedFavourite) {
      selectedFavourite = item.id;
      // save pref
      chrome.storage.sync.set({'favouriteOption': selectedFavourite}, function() {
        // Notify that we saved.
        console.log('saved', selectedFavourite);
      });
      // update main item title
      updateMainItemTitle();
    }
  }

}
