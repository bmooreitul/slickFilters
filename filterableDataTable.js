/*
	============================ EXAMPLE JAVASCRIPT =======================

	//USE .filterableDataTable INSTEAD OF .DataTable

	//RANGES ARE SET IN THE COLUMN DEFINITIONS
	//SINGLE SLICK FILTERS ARE SET IN THE COLUMN DEFINITIONS USING sfFilter

	//SUPPORTED COLUMN DEFINITIONS
	sfRange
		alias of "data-sf-range" 
		accepts: 
			- "date"
			- "numeric"
	sfFilter
		alias of "data-sf-filter"
		accepts: 
			- "date"
			- "numeric"
			- "select"

	sfSelectOptions 
		alias of "data-sf-select-options" 
		accepts: 
			- array of values, 
			- object of key value pairs

	DTInvoicesTable = $('#invoices-data-table').filterableDataTable({
		ajax: {
			url: "{{ route('admin-all-invoices.dt') }}",
			type: 'post',
			data: function (d) {
            	d.type 					= $("#filter-invoice-type").val();
            	d.corporationSearch 	= $('[name="corporationSearch"]').val();
            	d.invoiceSearch 		= $('[name="invoiceSearch"]').val();
            	d.invoiceSearchAmount 	= $('[name="invoiceSearchAmount"]').val();
            	d.startDate 			= $('[name="startDate"]').val();
            	d.endDate 				= $('[name="endDate"]').val();
            	d.dateType 				= $('[name="dateType"]').val();
            },
		},
		columns: [
			{data: 'doc_number'},
			{data: 'customer_name', name: 'invoices.customer_name'},
			{data: 'created_at', name: 'invoices.created_at', sfRange: 'date'},
			{data: 'invoice_due', name: 'invoices.invoice_due', sfFilter: 'date'},
			{data: 'sent_at', name: 'invoices.sent_at'},
			{data: 'amount', name: 'invoices.total_amount', sfRange: 'numeric'},
			{data: 'invoice_status', name: 'invoices.invoice_status'},
			{data: 'action', 'sortable': false},
		],
		order: [
			[2, 'desc']
		],
	})

	====================== HTML DATA ATTRIBUTE OPTIONS ================

	data-sf-range="{type}" type can be one of (date,numeric)
	data-sf-filter="{type}" type can be one of (date,numeric,select)
	data-sf-select-options="{options}" options can be a json object of associative key value pairs or an array of values

	============================ EXAMPLE HTML =======================

	//COLUMN DEFINITIONS CAN BE DEFINED USING A data-* ATTRIBUTE ON A HEADER COLUMN (SEE Invoice # COLUMN)

	<table class="table p-0 m-0" id="invoices-data-table">
		<thead>
			<th data-name="invoices.doc_number">Invoice #</th>
			<th>Corporation</th>
			<th>Created</th>
			<th>Due</th>
			<th>Sent</th>
			<th>Amount</th>
			<th>Status</th>
			<th data-filterable="false" data-sortable="false"></th>
		</thead>
	</table>


	======================== LARAVEL DATATABLES RANGE FILTERING ================

	$query = \App\Models\SomeModel::query();

	//CHECK FOR RANGE FILTERING
	if(is_array(request()->_ranges) && !empty(request()->_ranges)){

		//LOOP THROUGH RANGES
		foreach(request()->_ranges as $colKey => $rangeData){

			//CHECK FOR START RANGE
			if(isset($rangeData['start']) && strlen($rangeData['start'])){

				//NUMERIC RANGE
				if($rangeData['type'] == 'numeric') $query->where($rangeData['search']['name'], '>=', $rangeData['start']);

				//DATE RANGE
				elseif($rangeData['type'] == 'date') $query->where($rangeData['search']['name'], '>=', \Carbon\Carbon::parse($rangeData['start']));
			}

			//CHECK FOR END RANGE
			if(isset($rangeData['end']) && strlen($rangeData['end'])){

				//NUMERIC RANGE
				if($rangeData['type'] == 'numeric') $query->where($rangeData['search']['name'], '<=', $rangeData['end']);

				//DATE RANGE
				elseif($rangeData['type'] == 'date') $query->where($rangeData['search']['name'], '<=', \Carbon\Carbon::parse($rangeData['end']));
			}
		}
	}
*/

$.fn.filterableDataTable = function(options){

	var defaults = {
		slickFilter 	: true,
		processing 		: true,
		serverSide 		: true,
		autoWidth 		: false,
		orderCellsTop 	: true,
		language 		: {
			lengthMenu: '<span class="d-inline-block">Show&nbsp;</span> <select class="form-select d-inline-block my-0" style="width:100px;">'+
			'<option value="10">10</option>'+
			'<option value="25">25</option>'+
			'<option value="50">50</option>'+
			'<option value="100">100</option>'+
			'</select>',
			//sInfoFiltered: '',
			sInfo: 'Showing _START_ to _END_ of _TOTAL_ Results',
		},
		dom: "<'row' <'col'>>t<'row p-3' <'col'i><'col text-end align-items-top'l><'col-auto'p>>",
	}

	//OVERRIDE SERVERSIDE
	if(typeof(options.ajax) === 'undefined'){
		defaults.serverSide = false;
		defaults.processing = false;
	}

	//BUILD THE OPTIONS
	var options = $.extend(true, defaults, options);

	//GET THE TABLE
	var table 	= $(this);

	//CHECK IF SLICK FILTERS SHOULD RUN
	if(options.slickFilter === false) return $(table).DataTable(options);

	//CLONE THE HEADER ROW
	$('thead tr', $(table)).clone(true).addClass('slick-datatable-filters').css('opacity', '0').appendTo($('thead', $(table)));

	//SEND BACK THE DATA TABLE
	return $(table).on('preInit.dt', function(e, settings){

		//INITIALIZE RANGES
		var ranges = [];

		//GET THE API
		var api = new $.fn.dataTable.Api(settings);

		//LOOP THROUGH THE FIRST ROW OF EACH COLUMN
		api.columns().eq(0).each(function (colIdx){

			//GET THE TITLE AND CELL 
			var title = $('.slick-datatable-filters th', table).eq($(api.column(colIdx).header()).index()).text();
			var cell  = $('.slick-datatable-filters th', table).eq($(api.column(colIdx).header()).index()).empty();

			//FORMAT HTML5 DATA ATTRIBUTES
			[].forEach.call($(cell)[0].attributes, function(attr) { if(/^data-/.test(attr.name)) $(cell).data(attr.name.substr(5).replace(/-(.)/g, function ($0, $1) { return $1.toUpperCase(); }), attr.value); });

			//FLAG AS FILTERABLE OR NOT
			var filterable  = $(cell).data('filterable') == 'false' ? false : true;

			//DEFAULT TO NO FILTER RENDERED
			var filterRendered = false;

			//IF FILTERABLE
			if(filterable){

				//GET THE COLUMN DATA
				colInfo = $.extend(true, $(cell).data(), options.columns[colIdx]);

				//HANDLE SELECT FILTERS
				if(colInfo.sfFilter == 'select'){		

					if(typeof(colInfo.sfSelectOptions) == 'object'){

						//HANDLE AUTOCOMPLETE
						if(typeof(colInfo.sfSelectOptions.ajax) !== 'undefined'){
							//BUILD AUTOCOMPLETE LOGIC HERE
						}

						//NO AUTOCOMPLETE SO PARSE OBJECT OR ARRAY
						else{

							//INITIALIZE THE DROPDOWN
							var selectInput = $('<select class="form-select form-select-sm"><option value="">All</option></select>');

							//BUILD THE DROPDOWN OPTIONS
							for([key, value] of Object.entries(colInfo.sfSelectOptions)) $(selectInput).append('<option value="'+(Array.isArray(colInfo.sfSelectOptions) ? value : key)+'">'+value+'</option>');

							//LISTEN FOR CHANGES AND APPEND TO THE CELL						
							$(selectInput).on('change', function(e){
								if(!this.value.length) api.column(colIdx).search(this.value).draw();
								else api.column(colIdx).search("^" + this.value + "$", true, false, true).draw(); 
							}).appendTo($(cell));
						}
					}

					filterRendered = true;
				}

				//HANDLE NUMERIC RANGE FILTERS
				else if(colInfo.sfRange == 'numeric'){
					var rangeName 		= colInfo.data;
					var dbField 		= colInfo.name;
					var rangeWrap       = $('<div class="row"></div>').appendTo($(cell));
					var startRangeCol   = $('<div class="col pe-1"></div>').appendTo($(rangeWrap));
					var endRangeCol     = $('<div class="col ps-1"></div>').appendTo($(rangeWrap));
					

					if(typeof(options.serverSide) !== 'undefined' && options.serverSide == true){
						var startRangeInput = $('<input type="number" step="any" class="form-control form-control-sm p-1" placeholder="From" id="'+rangeName+'-start">').on('keyup change search', function(e){ api.draw(); }).appendTo($(startRangeCol));
						var endRangeInput   = $('<input type="number" step="any" class="form-control form-control-sm p-1" placeholder="To" id="'+rangeName+'-end">').on('keyup change search', function(e){ api.draw(); }).appendTo($(endRangeCol));

						ranges.push({
							col 	: colIdx,
							search 	: {data: colInfo.data, name: colInfo.name},
							start 	: $(startRangeInput),
							end 	: $(endRangeInput),
							type 	: 'numeric',
						});
					}
					else{
						var startRangeInput = $('<input type="search" class="form-control form-control-sm p-1" placeholder="From" id="'+rangeName+'-start">').on('keyup change search', function(e){ api.column(colIdx).search(this.value).draw(); }).appendTo($(startRangeCol));
						var endRangeInput   = $('<input type="search" class="form-control form-control-sm p-1" placeholder="To" id="'+rangeName+'-end">').on('keyup change search', function(e){ api.column(colIdx).search(this.value).draw(); }).appendTo($(endRangeCol));

						
						$.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {
							var min = parseInt($(startRangeInput).val(), 10);
							var max = parseInt($(endRangeInput).val(), 10);
							var searchableCol = parseFloat(data[colIdx]) || 0; // use data for the age column
						 
							if (
								(isNaN(min) && isNaN(max)) ||
								(isNaN(min) && searchableCol <= max) ||
								(min <= searchableCol && isNaN(max)) ||
								(min <= searchableCol && searchableCol <= max)
							) {
								return true;
							}
							return false;
						});
					}
					
					filterRendered      = true;
				}

				//HANDLE DATE RANGE FILTERS
				else if(colInfo.sfRange == 'date'){

					var rangeName 		= colInfo.data;
					var dbField 		= colInfo.name;
					var rangeWrap       = $('<div class="row"></div>').appendTo($(cell));
					var startRangeCol   = $('<div class="col-6 pe-1"></div>').appendTo($(rangeWrap));
					var endRangeCol     = $('<div class="col-6 ps-1"></div>').appendTo($(rangeWrap));
					

					if(typeof(options.serverSide) !== 'undefined' && options.serverSide == true){
						var startRangeInput = $('<input type="date" class="form-control form-control-sm p-1" placeholder="From" id="'+rangeName+'-start">').on('keyup change search', function(e){ api.draw(); }).appendTo($(startRangeCol));
						var endRangeInput   = $('<input type="date" class="form-control form-control-sm p-1" placeholder="To" id="'+rangeName+'-end">').on('keyup change search', function(e){ api.draw(); }).appendTo($(endRangeCol));

						ranges.push({
							col 	: colIdx,
							search 	: {data: colInfo.data, name: colInfo.name},
							start 	: $(startRangeInput),
							end 	: $(endRangeInput),
							type 	: 'date',
						});
					}
					else{
						var startRangeInput = $('<input type="date" class="form-control form-control-sm p-1" placeholder="From" id="'+rangeName+'-start">').on('keyup change search', function(e){ api.column(colIdx).search(this.value).draw(); }).appendTo($(startRangeCol));
						var endRangeInput   = $('<input type="date" class="form-control form-control-sm p-1" placeholder="To" id="'+rangeName+'-end">').on('keyup change search', function(e){ api.column(colIdx).search(this.value).draw(); }).appendTo($(endRangeCol));
						
						$.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {
							var min = parseInt($(startRangeInput).val(), 10);
							var max = parseInt($(endRangeInput).val(), 10);
							var searchableCol = new Date( data[colIdx]);
						 
							if (
								(isNaN(min) && isNaN(max)) ||
								(isNaN(min) && searchableCol <= max) ||
								(min <= searchableCol && max === null) ||
								(min <= searchableCol && searchableCol <= max)
							) {
								return true;
							}
							return false;
						});
					}
					
					filterRendered      = true;
				}

				//HANDLE DATE FILTER
				else if(colInfo.sfFilter == 'date'){

					//BUILD THE DEFAULT INPUT FILTER
					$('<input type="date" placeholder="'+title+'" class="form-control form-control-sm p-1"'+(!filterable ? "disabled" : '')+' style="'+(!filterable ? "opacity:0; pointer-events: none;" : '')+'">').on('keyup change search', function (e) {

						//ALLOW SEARCHING THIS COLUMN
						api.column(colIdx).search(this.value).draw();

					}).appendTo($(cell));

					filterRendered      = true;
				}

				//HANDLE TEXT FILTER
				if(!filterRendered){

					//BUILD THE DEFAULT INPUT FILTER
					$('<input type="search" placeholder="'+title+'" class="form-control form-control-sm p-1"'+(!filterable ? "disabled" : '')+' style="'+(!filterable ? "opacity:0; pointer-events: none;" : '')+'">').on('keyup change search', function (e) {

						//ALLOW SEARCHING THIS COLUMN
						api.column(colIdx).search(this.value).draw();

					}).appendTo($(cell));
				}   
			}          
		});

		$('.slick-datatable-filters', $(this)).css('opacity', '1');
		

		//CHECK IF SERVER SIDE
		if(typeof(options.serverSide) !== 'undefined' && options.serverSide == true){

			//CHECK IF AJAX DATA IS A FUNCTION
			if(typeof(options.ajax.data) === 'function'){

				//CLONE THE DATA FUNCTION
				Function.prototype.cloneForSlickDataTableFilters = function() {
					var that = this;
					var temp = function temporary() { return that.apply(this, arguments); };
					for(var key in this) if(this.hasOwnProperty(key)) temp[key] = this[key];
					return temp;
				};

				//SET THE NEW DATA FUNCTION
				var newDataFunction = settings.ajax.data.cloneForSlickDataTableFilters();

				//OVERRIDE THE AJAX DATA FUNCTION
				settings.ajax.data = function(d){
					if(ranges.length){
						var tempRanges = {};
						for(var x = 0; x < ranges.length; x++){
							tempRanges[ranges[x].col] = {
								search  : ranges[x].search,
								start 	: $(ranges[x].start).val(),
								end 	: $(ranges[x].end).val(),
								type 	: ranges[x].type,
							};
						}
						d._ranges = tempRanges;
					}
					newDataFunction(d);
				}
			}
		}
	}).DataTable(options);
}