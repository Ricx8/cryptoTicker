#!/usr/bin/gjs

imports.gi.versions.Gtk = '3.0'
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Lang = imports.lang;

class Application {

  //create the application
  constructor() {
    this.application = new Gtk.Application();

   //connect to 'activate' and 'startup' signals to handlers.
   this.application.connect('activate', this._onActivate.bind(this));
   this.application.connect('startup', this._onStartup.bind(this));
  }

  //create the UI
  _buildUI() {
    //
    this.treeTickerList = [];
    this.lastIterSelected = [null, null, null];

    this._window = new Gtk.ApplicationWindow({
      application: this.application,
      border_width: 10,
      title: "CryptoTicker"
    });
    this._window.set_default_size(400, 400);

    // Create a Grid
    this.mainGrid = new Gtk.Grid ({
      column_homogeneous: true,
      column_spacing: 20,
      row_spacing: 20
    });

    // Make the pulldowm for all the coins
    this.tickerPullDowm = new Gtk.ComboBoxText();
    let tickerList = -1;
    while (tickerList == -1){
      tickerList = this._getTickerList();
    }

    for (let i=0; i<tickerList.length; i++){
      this.tickerPullDowm.append_text(tickerList[i]);
    }
    this.tickerPullDowm.set_active(0);

    // Label for "fix value"
    this.fixVLabel = new Gtk.Label({ label: "Fix value",  margin_left: 50});
    this.fixVEntry = Gtk.SpinButton.new_with_range (0, 10, 1);

    this.addButton = new Gtk.Button({label: "Add ticker"});
    this.removeButton = new Gtk.Button({label: "-"});
    this.setPanelTickerButton = new Gtk.Button({label: "Set to panel"});
    this.saveButton = new Gtk.Button ({label: "Save changes"});

    // Create the underlying liststore for the tickers
    this.tickerListStore = new Gtk.ListStore();
    this.tickerListStore.set_column_types([
      GObject.TYPE_STRING,
      GObject.TYPE_STRING
    ]);

    this._initTickerList();

    // Create the treeview
    this.tickerListUI = new Gtk.TreeView({
      expand: true,
      model: this.tickerListStore
    });

    let tickerCol = new Gtk.TreeViewColumn({ title: "Ticker" });
    let fixValCol = new Gtk.TreeViewColumn({ title: "Fix val" });

    // Create a cell renderer for normal text
    let normal = new Gtk.CellRendererText();

    // Pack the cell renderers into the columns
    tickerCol.pack_start (normal, true);
    fixValCol.pack_start (normal, true);

    // Set each column to pull text from the TreeView's model
    tickerCol.add_attribute (normal, "text", 0);
    fixValCol.add_attribute (normal, "text", 1);

    // Insert the columns into the treeview
    this.tickerListUI.insert_column (tickerCol, 0);
    this.tickerListUI.insert_column (fixValCol, 1);

    this.mainGrid.attach(this.tickerPullDowm,  0, 0, 1, 1);
    this.mainGrid.attach(this.fixVLabel, 1, 0, 1, 1);
    this.mainGrid.attach(this.fixVEntry, 2, 0, 1, 1);
    this.mainGrid.attach(this.addButton, 3, 0, 1, 1);
    this.mainGrid.attach(this.tickerListUI, 0, 1, 4, 1);
    this.mainGrid.attach(this.removeButton, 0, 2, 1, 1);
    this.mainGrid.attach(this.setPanelTickerButton, 1, 2, 1, 1);
    this.mainGrid.attach(this.saveButton, 3, 2, 1, 1);

    this._window.add(this.mainGrid)

    // Set the first item to be in the panel
    /*
      TODO
    */

    // If I click The add button
    this.addButton.connect("clicked", this._addTicker.bind(this));

    this.removeButton.connect("clicked", this._removeTicker.bind(this));
    this.setPanelTickerButton.connect("clicked", this._setPanelTicker.bind(this));
    this.saveButton.connect("clicked", this._saveChanges.bind(this));
  }

  //handler for 'activate' signal
  _onActivate() {
    //show the window and all child widgets
    this._window.show_all();
  }

  //handler for 'startup' signal
  _onStartup() {
    this._buildUI();
  }

  _getTickerList(){
    let rTickers = [];
    let sessionSync = new Soup.SessionSync();
    let msg = Soup.Message.new('GET', 'https://api.binance.com/api/v3/ticker/price');
    sessionSync.send_message(msg);

    if (msg.status_code == 200){
      let tickers = JSON.parse(msg.response_body.data);

      rTickers.unshift("Select a ticker");
      for (let i=0; i<tickers.length; i++){
        rTickers.push(tickers[i]["symbol"]);
      }
    }
    else{
      rTickers = -1;
    }

    return(rTickers);
  }

  _initTickerList(){
    let userName = GLib.spawn_command_line_sync("id -u -n")[1].toString().replace('\n', '');
    let settingsData = JSON.parse(GLib.spawn_command_line_sync("cat /home/"+userName+"/.local/share/gnome-shell/extensions/cryptoTicker@Ricx8/settings.conf")[1].toString() );

    for(let i=0; i<settingsData.length; i++){
      this._addTicker( settingsData[i]["coin"], settingsData[i]["toFixed"]);
    }
  }

  // Funtion that add ticker to the list
  _addTicker(newTicker=null, newFixVal=null){
    if ((newTicker == null) || (newFixVal == null) ){
      newFixVal = this.fixVEntry.get_text();
      newTicker = this.tickerPullDowm.get_active_text();
    }

    if (newTicker != "Select a ticker"){
      let tickerInList = false;
      for(let i=0; i<this.treeTickerList.length; i++){
        if (this.treeTickerList[i]["coin"] == newTicker){
          tickerInList = true;
          break;
        }
      }

      if (!(tickerInList)){
        let tmpObj = new Object();
        tmpObj["coin"] = newTicker;
        tmpObj["toFixed"] = newFixVal;

        if (newFixVal == "0") tmpObj["toFixed"] = "default";

        this.treeTickerList.push( tmpObj );

        this.tickerListStore.set(this.tickerListStore.append(), [0, 1], [newTicker, tmpObj["toFixed"]]);
      }
    }
  }

  // Function that will remove ticker from the list.
  _removeTicker(){
    let tickerSelected = this.tickerListUI.get_selection().get_selected()[0];

    if (tickerSelected){
      let iter = this.tickerListUI.get_selection().get_selected()[2];

      let tmpObj = new Object();
      tmpObj["coin"] = this.tickerListStore.get_value (iter, 0)
      tmpObj["toFixed"] = this.tickerListStore.get_value (iter, 1);

      let i =0;
      while (i<this.treeTickerList.length){
        if (this.treeTickerList[i]["coin"] == tmpObj["coin"]) {
          this.treeTickerList.splice(i, 1);
          break;
        }

        i++;
      }

      this.tickerListStore.remove(iter);
    }
  }

  _setPanelTicker(){
    let iter = this.tickerListUI.get_selection().get_selected()[2];
    let tickerSelected = "* "+this.tickerListStore.get_value (iter, 0)

    // If the last iter selected is not empty then delete the '*' mark from the last iter
    if (this.lastIterSelected[0] != null){
      this.tickerListStore.set(this.lastIterSelected[0], [0], [this.lastIterSelected[1]]);
    }

    // Save th current iter as last iter so I can undo the '*' mark in the future.
    this.lastIterSelected[0] = iter;
    this.lastIterSelected[1] = this.tickerListStore.get_value (iter, 0);
    this.lastIterSelected[2] = this.tickerListStore.get_value (iter, 1);
    print("panelTicker: "+this.lastIterSelected[1]);

    // Set the '*' mark
    this.tickerListStore.set(iter, [0], [tickerSelected]);
  }

  _saveChanges(){
    if (this.lastIterSelected[0] != null){
      for (let i=0; i<this.treeTickerList.length; i++){
        if (this.treeTickerList[i]["coin"] == this.lastIterSelected[1] ) {
          this.treeTickerList.splice(i, 1);
          break;
        }
      }

      // Add the panelTicker to the first possition
      let tmpObj = new Object();
      tmpObj["coin"] = this.lastIterSelected[1];
      tmpObj["toFixed"] = this.lastIterSelected[2];

      if (tmpObj["toFixed"] == "0") tmpObj["toFixed"] = "default";

      this.treeTickerList.unshift( tmpObj );
    }

    let stringSettings = JSON.stringify(this.treeTickerList).replace(/"/g, "\\\"");
    print(stringSettings);

    let userName = GLib.spawn_command_line_sync("id -u -n")[1].toString().replace('\n', '');
    GLib.spawn_command_line_sync("/home/"+userName+"/.local/share/gnome-shell/extensions/cryptoTicker@Ricx8/settingsWin/writeSettings.sh "+stringSettings);
    //GLib.spawn_command_line_sync("busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart(\"Restarting…\")'");
    GLib.spawn_command_line_sync("gnome-shell-extension-tool -r cryptoTicker@Ricx8");
  }

};

//run the application
let app = new Application();
app.application.run(ARGV);
