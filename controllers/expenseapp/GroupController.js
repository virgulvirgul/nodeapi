const Model = require("../../systems/model");
var ObjectId = global.mongoose.Types.ObjectId;
module.exports = {
	create : function(req, res) {
		var postData = req.body;
		postData.createdBy = new ObjectId(postData.createdBy);
		members = postData.members;
		for(let m in postData.members ) {
	 		members[m]['id'] = new ObjectId(members[m]['id']);
	 	}
	 	postData.members = members;

		if(postData.startdate) {
			postData.startdate = new Date(postData.startdate);
		}
		Model.expense.group.insert(postData, (returnData) => {
			var members = req.body.members;
			var admin = members.find(function(m){
				return m.admin == 1;
			})
			var promises = [];
			for(let index in members) {
				
				promises[index] = new Promise(function(resolve, reject){
					var m = members[index];
					if (m.deposit > 0) {
						Model.expense.payment.insert({
							paidBy : new ObjectId(m.id),
							groupId : new ObjectId(returnData._id),
							sharewith : [{id : new ObjectId(admin.id), name : admin.name}],
							amount : parseInt(m.deposit),
							parHeadAmount : parseInt(m.deposit),
							type : 'Deposit',
							addedBy : new ObjectId(admin.id),
							addedOn : new Date(),
						}, (payData)=> {})
					}

				});
			}
			Promise.all(promises).then(res.send(returnData));
			
		})
	},
	getUserGroups : function(req, res) {

		global.systems.model.expense.group.userGroups(req.body.id, (returnData)=>{
			res.send(returnData);
		})
	},
	getGroupDetails:function(req,res)
	{
		global.systems.model.expense.group.getGroupDetails(req.body.id, (returnData)=>{
			if(returnData){
				var membersList = [];
				var members = returnData.get('members');
				var promises = [];
				var totalAmount = 0;

				for (let m of members) {
					promises.push(new Promise(function(resolve, reject) {
						
						global.systems.model.expense.payment.getTotalDepositByUser(m.id, returnData.get('_id'), (depositByData)=>{

							global.systems.model.expense.payment.getTotalExpecsePaidByUser(m.id, returnData.get('_id'), (paidByData)=>{
								global.systems.model.expense.payment.getTotalExpecsePaidForUser(m.id, returnData.get('_id'), (paidForData)=>{
									
									var row = {
										index : members.indexOf(m),
										id : m.id,
										name : m.name,
										admin : m.admin,

										deposit : parseFloat(depositByData).toFixed(2),
										paidBy : parseFloat(paidByData).toFixed(2),
										paidFor : parseFloat(paidForData).toFixed(2),
										balance : parseFloat((depositByData +paidByData ) - paidForData).toFixed(2)
									}
									resolve(row);
									
								});
								
							})
						});
					}) );
				}
				Promise.all(promises).then(function(membersList){
					global.systems.model.expense.payment.getTotalExpecseByGroupAmount(req.body.id, (amount)=>{
						totalAmount  = amount;
						res.send({	name : returnData.get('name'), 
								id : returnData.get('_id'), 
								createdBy : returnData.get('createdBy'), 
								createdOn : returnData.get('createdOn'), 
								startdate : returnData.get('startdate'),
								totalAmount : parseFloat(totalAmount).toFixed(2),
								members : membersList});
					});
					
				})
				
			}
		});
	},

	memberDepositEdit : function(req, res)
	{

		global.systems.model.expense.group.editDeposit(req.body.groupId,req.body.memberId, req.body.deposit.new, (returnData)=>{

			var newDeposit = req.body.deposit.new - req.body.deposit.old;
			global.systems.model.expense.payment.insert({
				paidBy : new ObjectId(req.body.memberId),
				groupId : new ObjectId(req.body.groupId),
				sharewith : [{id : new ObjectId(req.body.admin.id), name : req.body.admin.name  }],
				amount : newDeposit,
				parHeadAmount : newDeposit,
				type : 'Deposit',
				addedBy : new ObjectId(req.body.admin.id),
				addedOn : new Date(),
			}, (payData)=> {
				res.send({success:1})
				
			})
		})
	},

	memberSavePay : function(req, res) {
		if(req.body.id != undefined && req.body.id !='') {
			global.systems.model.expense.payment.deleteExpense(req.body.id, (returnData)=>{});
		}
		let payData = {
			paidBy : new ObjectId(req.body.payBy),
			groupId : new ObjectId(req.body.groupId),
			amount : parseInt(req.body.amount),
			type : req.body.category,
			description : req.body.description,
			payDate : new Date(req.body.payDate),
			sharewith : [],
			addedBy : new ObjectId(req.body.addedBy),
			addedOn : new Date(),
		};
		let parHeadAmount = (payData.amount / req.body.shareMembers.length).toFixed(2);
		payData.parHeadAmount = parseFloat(parHeadAmount);
		for (let m of req.body.shareMembers)
		{
			payData.sharewith.push({
				id : new ObjectId(m.id),
				name : m.name,
			})
		}
		global.systems.model.expense.payment.insert(payData, (returnData)=>{
			res.send({msg : 'success'});
		})

	},

	groupExpenseHistory : function(req, res)
	{
		groupId  = req.body.id;
		var promises = [];
		var result = [];
		global.systems.model.expense.payment.getGroupExpense(groupId, (responseData)=>{
			for(let expense of responseData) {

				

				promises.push( new Promise((resolve, reject)=>{

					global.systems.model.expense.users.fetchOne({_id : new ObjectId(expense.get('paidBy'))}, (paidByuserData)=>{
						global.systems.model.expense.users.fetchOne({_id : new ObjectId(expense.get('addedBy'))}, (addedByuserData)=>{
							var row = {
								id : expense._id,
								description : expense.get('description'),
								amount : parseFloat(expense.get('amount')).toFixed(2),
								type : expense.get('type'),
								payDate : expense.get('payDate'),
								sharewith : expense.get('sharewith'),
								paidUser : paidByuserData.get('name'),
								paidBy : paidByuserData.get('_id'),
								addedBy : addedByuserData.get('name')
							}
							resolve(row);
						});
							
							
					})
				}))
			}
			Promise.all(promises).then((expenseList)=>{
				res.send(expenseList);
			})
		});
		
	},

	deleteGroupExpense : function(req, res) {
		global.systems.model.expense.payment.deleteExpense(req.body.id, (responsedata)=>{
			res.send({status : responsedata});
		})
	},

	addGroupMember : function(req, res) {
		global.systems.model.expense.group.getGroupDetails(req.body.id, (returnData)=>{
			let newUser = req.body.user;
			let checkmemberExist = returnData.get('members').find(function(m){
				return (newUser.id == m.id);
			});
			if(checkmemberExist == null) {

				global.systems.model.expense.group.addMember(req.body.id, newUser, (responseData)=>{
				
					var admin = returnData.get('members').find(function(m){
						return m.admin == 1;
					})
					global.systems.model.expense.payment.insert({
								paidBy : new ObjectId(req.body.user.id),
								groupId : new ObjectId(req.body.id),
								sharewith : [{id : new ObjectId(admin.id), name : admin.name}],
								amount : parseInt(req.body.user.deposit),
								parHeadAmount : parseInt(req.body.user.deposit),
								type : 'Deposit',
								addedBy : new ObjectId(admin.id),
								addedOn : new Date(),
							}, (payData)=> {
								
								res.send(responseData);
							})
				});
			} else {
				res.send({status:0, message: newUser.name+' alread in this group'});
			}
		})
	},

	deleteGroup : function(req, res)
	{
		global.systems.model.expense.group.deleteGroup(req.body.id,(returnData)=>{
			global.systems.model.expense.payment.deleteGroupExpense(req.body.id,(responseData)=>{
				res.send({status:true});	
			})
		})
	},

	deleteGroupUser : function(req, res)
	{
		global.systems.model.expense.group.deleteGroupUser(req.body.groupId, req.body.userId,(returnData)=>{
			global.systems.model.expense.payment.deleteMemberExpense(req.body.groupId, req.body.userId, (response)=>{
				res.send({status:true});	
			})
			
		})
	},

	getGroupStatistics : function(req, res)
	{
		global.systems.model.expense.payment.getTotalByCategory(req.body.id,'type', (categoryTotalData)=>{
			var data = {};
			data.category = categoryTotalData;
			global.systems.model.expense.payment.getTotalByCategory(req.body.id,'paidBy',(userTotalData)=>{
				data.paidBy = [];
				var promises = [];
				if(userTotalData) {
					for(let u of userTotalData){
						promises.push(new Promise((resolve,reject)=>{
							global.systems.model.expense.users.fetchOne({_id: new ObjectId( u._id )}, (uData)=>{
									resolve({
										name : uData.get('name'),
										total : u.total
									});
							})
						}))
					}
				}
				Promise.all(promises).then((userData)=>{
					data.paidBy = userData;
					global.systems.model.expense.payment.getTotalByCategory(req.body.id,'date',(dateTotalData)=>{
						data.date = dateTotalData;
						res.send(data);	
					});
				})
			});
		});
	},

	setGroupAdmin(req, res)
	 {
	 	var members = req.body.members;
	 	for(let m in req.body.members ) {
	 		members[m]['id'] = new ObjectId(members[m]['id']);
	 	}
	 	
	 	global.systems.model.expense.group.updateMemberGroup(req.body.groupId, members, (resdata)=>{
	 		var adminUser = req.body.adminUser;
	 		adminUser.id = new ObjectId(adminUser.id);
	 		global.systems.model.expense.payment.changeGroupDepositUser(req.body.groupId, [adminUser], (responseData)=>{
	 			res.send(responseData);
	 		})
	 	} )
	 },

	 exportReport(req, res)
	 {
		const groupId = req.params.groupid;
		var conversion = require("phantom-html-to-pdf")();

		global.systems.model.expense.group.getGroupDetails(groupId, (returnData)=>{
			var pdfResultHtml ='';
			pdfResultHtml += '<h1 style="float:left">'+returnData.get('name')+'</h1>';
			pdfResultHtml += '<div style="float:right; font-size:12px;">';
			pdfResultHtml += "<p style='margin:0; padding:0;'><strong>Start From :</strong> "+ global.moment(returnData.get('startdate')).format('DD-MM-YYYY')+"</p>";
			pdfResultHtml += "<p style='margin:0; padding:0;'><strong>Created On :</strong> "+ global.moment(returnData.get('createdOn')).format('DD-MM-YYYY')+"</p>";
			
			var membersList = [];
			var members = returnData.get('members');

			let createUser = members.find(m=>{
				return m.id == returnData.get('createdBy');
			})
			pdfResultHtml += "<p style='margin:0; padding:0;'><strong>Created By :</strong> "+ createUser.name+"</p>";

			let adminUser = members.find(m=>{
				return m.admin == 1;
			})
			pdfResultHtml += "<p style='margin:0; padding:0;'><strong>Admin  :</strong> "+ adminUser.name+"</p>";
			pdfResultHtml += "</div>";
			pdfResultHtml += "<div style='clear:both'></div>";
			pdfResultHtml += "<hr/>";
			pdfResultHtml += '<h4>Members</h4>';
			pdfResultHtml += "<div style='font-size:12px'>";
			pdfResultHtml += "<table style='width:100%;border:1px solid #CCC;font-size:12px' cellpadding='3' cellspacing='0'>"
			pdfResultHtml += '<thead>';
			pdfResultHtml += '<tr>';
			pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Name</th>';
			pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Deposit</th>';
			pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Pay</th>';
			pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Pay Share</th>';
			pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Balance</th>';
			pdfResultHtml += '</tr>';
			pdfResultHtml += '</thead>';
			pdfResultHtml += '<tbody>';
			var promises = [];
			for (let m of members) {
				promises.push(new Promise(function(resolve, reject) {
					global.systems.model.expense.payment.getTotalDepositByUser(m.id, returnData.get('_id'), (depositByData)=>{

						global.systems.model.expense.payment.getTotalExpecsePaidByUser(m.id, returnData.get('_id'), (paidByData)=>{
							global.systems.model.expense.payment.getTotalExpecsePaidForUser(m.id, returnData.get('_id'), (paidForData)=>{
								
								pdfResultHtml += '<tr>';
									pdfResultHtml += '<td>'+m.name+'</td>';
									pdfResultHtml += '<td>&#8377; '+parseFloat(depositByData).toFixed(2)+'</td>';
									pdfResultHtml += '<td>&#8377; '+parseFloat(paidByData).toFixed(2)+'</td>';
									pdfResultHtml += '<td>&#8377; '+parseFloat(paidForData).toFixed(2)+'</td>';
									pdfResultHtml += '<td>&#8377; '+(parseFloat((depositByData +paidByData ) - paidForData).toFixed(2))+'</td>';
								pdfResultHtml += '</tr>';
								resolve(m);
								
							});
							
						})
					});
				}));
			}
			Promise.all(promises).then(function(membersList){
				pdfResultHtml += '</tbody>';
				pdfResultHtml += "</table>";
				pdfResultHtml += "</div>";

				pdfResultHtml += '<h4>Expense History</h4>';
				pdfResultHtml += "<div style='font-size:10px'>";
				pdfResultHtml += "<table style='width:100%;border:1px solid #CCC;font-size:12px' cellpadding='3' cellspacing='0'>"
				pdfResultHtml += '<thead>';
				pdfResultHtml += '<tr>';
				pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Description</th>';
				pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Amount</th>';
				pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Paid By</th>';
				pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Added By</th>';
				pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Share With</th>';
				pdfResultHtml += '<th style="text-align:left;border-bottom:1px solid #CCC">Date</th>';
				pdfResultHtml += '</tr>';
				pdfResultHtml += '</thead>';
				pdfResultHtml += '<tbody>';
				
				promises = [];
				global.systems.model.expense.payment.getGroupExpense(groupId, (expenseData)=>{
					for(let expense of expenseData) {
						promises.push( new Promise((resolve, reject)=>{

							global.systems.model.expense.users.fetchOne({_id : new ObjectId(expense.get('paidBy'))}, (paidByuserData)=>{
								global.systems.model.expense.users.fetchOne({_id : new ObjectId(expense.get('addedBy'))}, (addedByuserData)=>{
									
									var row = {
										id : expense._id,
										description : expense.get('description'),
										amount : parseFloat(expense.get('amount')).toFixed(2),
										type : expense.get('type'),
										payDate : expense.get('payDate'),
										sharewith : expense.get('sharewith'),
										paidUser : paidByuserData.get('name'),
										paidBy : paidByuserData.get('_id'),
										addedBy : addedByuserData.get('name')
									}
									resolve(row);
								});
									
									
							})
						}))
					}
					Promise.all(promises).then((expenseList)=>{
						for (let expense of expenseList) {
							pdfResultHtml += '<tr>';
							pdfResultHtml += '<td>'+expense.description+'</td>';
							pdfResultHtml += '<td>&#8377; '+parseFloat(expense.amount).toFixed(2)+'</td>';
							pdfResultHtml += '<td>'+expense.paidUser+'</td>';
							pdfResultHtml += '<td>'+expense.addedBy+'</td>';
							pdfResultHtml += '<td>'+expense.sharewith.map(a => a.name);
							pdfResultHtml += '<td>'+global.moment(expense.payDate).format('DD-MM-YYYY')+'</td>';
							pdfResultHtml += '</tr>';
						}
						pdfResultHtml += '</tbody>';
						pdfResultHtml += '</table>';
						pdfResultHtml += "</div>";
						conversion({ html: pdfResultHtml }, function(err, pdf) {
							var output = global.fs.createWriteStream('public/expense/'+groupId+'.pdf')
							//console.log(pdf.logs);
							// since pdf.stream is a node.js stream you can use it
							// to save the pdf to a file (like in this example) or to
							// respond an http request.
							pdf.stream.pipe(output);
							res.send({status:1});
						});
					})
				});
				
			})
			
		});


		
	 }
}